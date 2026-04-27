#!/usr/bin/env python3
"""
verify.py - Sigillerie page-contract validator + Playwright runtime check.

Run by harness G3 gate. Opens an HTML deliverable, asserts the Sigillerie
page contract is met, dumps console errors, checks render correctness.

Page contract (per SKILL.md):
    window.__ready          always required (boolean true)
    window.__recording      reads-only signal, page may honor it
    window.__sceneReady     3D mode required (boolean true)
    window.__renderFrame    3D mode required (callable, takes t in ms or s)
    window.__duration       optional, scene length in seconds (number > 0)
    window.__audioCues      optional [{t, type, file?, position?}]
    window.__audioRuntime   audio mode required ('static' | 'tone' | 'wam2')
    window.__capabilities   optional { webgpu, webxr, modelViewer, audio }

CLI:
    python scripts/verify.py <input.html> [options]

    --strict              fail on any console warning (default: only errors fail)
    --3d                  apply 3D-mode page contract
    --audio               apply audio-mode contract
    --duration=<sec>      override expected duration (number > 0 in seconds)
    --screenshot=<path>   write a screenshot at end of run
    --output=<json>       write structured result JSON
    --timeout=<sec>       page-load timeout, default: 30
    --help

Exit codes:
    0   all passed
    1   page contract failed
    2   console errors (or warnings under --strict)
    3   image / font load failure
    4   timeout

Dependencies:
    pip install playwright
    python -m playwright install chromium
"""

import argparse
import asyncio
import json
import platform
import sys
import time
from pathlib import Path


# ============================================================================
# PARSE - args and validation
# ============================================================================

def build_parser():
    # caveman parser. one flag, one job.
    p = argparse.ArgumentParser(
        prog="verify.py",
        description="Sigillerie page-contract validator (Playwright runtime).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("input_html", help="Path to single-file HTML deliverable.")
    p.add_argument("--strict", action="store_true",
                   help="Fail on any console warning (default: only errors fail).")
    # argparse doesn't love a flag literally named --3d, so we map it.
    p.add_argument("--3d", dest="three_d", action="store_true",
                   help="Apply 3D-mode page contract (__renderFrame, __sceneReady).")
    p.add_argument("--audio", action="store_true",
                   help="Apply audio-mode contract (__audioRuntime).")
    p.add_argument("--duration", type=float, default=None,
                   help="Override expected duration in seconds (number > 0).")
    p.add_argument("--screenshot", default=None,
                   help="Write a screenshot at end of run.")
    p.add_argument("--output", default=None,
                   help="Write structured result JSON to this path.")
    p.add_argument("--timeout", type=float, default=30.0,
                   help="Page-load timeout in seconds (default 30).")
    return p


def angle_platform():
    # pick the right ANGLE backend for this machine. caveman dispatch.
    sysname = platform.system().lower()
    if sysname == "windows":
        return "d3d11"
    if sysname == "darwin":
        return "metal"
    return "vulkan"


def gpu_chromium_args():
    # match render-video.js GPU flag set so what verify sees == what the
    # recorder sees. webgpu + vulkan + ignore blocklist + autoplay open.
    return [
        "--enable-gpu",
        "--ignore-gpu-blocklist",
        f"--use-angle={angle_platform()}",
        "--enable-features=Vulkan,VulkanFromANGLE,DefaultANGLEVulkan",
        "--enable-unsafe-webgpu",
        "--enable-unsafe-swiftshader",
        "--autoplay-policy=no-user-gesture-required",
    ]


# ============================================================================
# LAUNCH - playwright bring-up + listeners
# ============================================================================

async def run_verify(args):
    # heavy import deferred so --help works without playwright installed.
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("ERROR: playwright not installed.")
        print("  pip install playwright")
        print("  python -m playwright install chromium")
        return 1, None

    html_path = Path(args.input_html).resolve()
    if not html_path.exists():
        print(f"ERROR: file not found: {html_path}")
        return 1, None
    if html_path.suffix.lower() != ".html":
        print(f"ERROR: not an .html file: {html_path}")
        return 1, None

    file_url = html_path.as_uri()

    # caveman state buckets. listeners append, main thread reads.
    console_messages = []
    errors = []
    warnings = []
    page_errors = []
    failed_requests = []

    result = {
        "input": str(html_path),
        "passed": False,
        "duration_sec": 0.0,
        "console_messages": console_messages,
        "errors": errors,
        "warnings": warnings,
        "page_errors": page_errors,
        "failed_requests": failed_requests,
        "page_contract": {},
        "checks": {},
        "screenshot": None,
        "exit_code": 0,
        "exit_reason": "",
    }

    started = time.time()
    timeout_ms = int(args.timeout * 1000)

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=gpu_chromium_args(),
        )
        context = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page = await context.new_page()

        # console listener. text + type + location for each msg.
        def on_console(msg):
            entry = {
                "type": msg.type,
                "text": msg.text,
                "location": msg.location,
            }
            console_messages.append(entry)
            if msg.type == "error":
                errors.append(entry)
            elif msg.type == "warning":
                warnings.append(entry)
        page.on("console", on_console)

        # uncaught js exceptions. these always fail.
        def on_pageerror(err):
            page_errors.append(str(err))
        page.on("pageerror", on_pageerror)

        # network watchdog. 4xx/5xx gets logged for asset checks.
        def on_response(resp):
            try:
                status = resp.status
                if status >= 400:
                    failed_requests.append({
                        "url": resp.url,
                        "status": status,
                        "resource_type": resp.request.resource_type,
                    })
            except Exception:
                # listener must never throw. swallow.
                pass
        page.on("response", on_response)

        # ====================================================================
        # PAGE LOAD
        # ====================================================================
        try:
            await page.goto(file_url, wait_until="load", timeout=timeout_ms)
        except Exception as e:
            await browser.close()
            result["exit_code"] = 4
            result["exit_reason"] = f"page-load timeout / failure: {e}"
            result["duration_sec"] = round(time.time() - started, 3)
            return 4, result

        # ====================================================================
        # ASSERT_CONTRACT
        # ====================================================================
        contract_ok, contract_err = await assert_page_contract(
            page, args, result, timeout_ms
        )
        if not contract_ok:
            # screenshot before bailing out so humans can see the broken state.
            await maybe_screenshot(page, args, result)
            await browser.close()
            result["exit_code"] = 1
            result["exit_reason"] = contract_err
            result["duration_sec"] = round(time.time() - started, 3)
            return 1, result

        # ====================================================================
        # ASSET_CHECKS - imgs, fonts, animation end-state
        # ====================================================================
        assets_ok, assets_err = await assert_assets(page, result)
        if not assets_ok:
            await maybe_screenshot(page, args, result)
            await browser.close()
            result["exit_code"] = 3
            result["exit_reason"] = assets_err
            result["duration_sec"] = round(time.time() - started, 3)
            return 3, result

        # wait for animation to reach end-state before final shot.
        # __recording is NOT set here - we want the natural one-shot to play.
        duration = result["page_contract"].get("__duration") or 0
        if args.duration is not None:
            duration = args.duration
        if duration and duration > 0:
            # cap at 30s so a misconfigured __duration doesn't hang the gate.
            wait_ms = int(min(duration, 30) * 1000) + 100
            await page.wait_for_timeout(wait_ms)
            result["checks"]["animation_completed"] = True
        else:
            # static page. brief settle.
            await page.wait_for_timeout(500)
            result["checks"]["animation_completed"] = True

        # final screenshot.
        await maybe_screenshot(page, args, result)

        # ====================================================================
        # CONSOLE GATE - errors always fail, warnings fail under --strict
        # ====================================================================
        await browser.close()

        if page_errors:
            result["exit_code"] = 2
            result["exit_reason"] = f"page error(s): {len(page_errors)}"
        elif errors:
            result["exit_code"] = 2
            result["exit_reason"] = f"console error(s): {len(errors)}"
        elif args.strict and warnings:
            result["exit_code"] = 2
            result["exit_reason"] = f"console warning(s) under --strict: {len(warnings)}"
        else:
            result["exit_code"] = 0
            result["passed"] = True

    result["duration_sec"] = round(time.time() - started, 3)
    return result["exit_code"], result


# ============================================================================
# ASSERT_CONTRACT - window.__ready / __sceneReady / __renderFrame / etc.
# ============================================================================

async def assert_page_contract(page, args, result, timeout_ms):
    contract = {}

    # __ready: required always. wait up to min(timeout, 30s).
    ready_wait_ms = min(timeout_ms, 30000)
    try:
        await page.wait_for_function(
            "window.__ready === true",
            timeout=ready_wait_ms,
        )
        contract["__ready"] = True
    except Exception:
        contract["__ready"] = False
        result["page_contract"] = contract
        return False, "window.__ready never became true within timeout"

    # snapshot the rest of the contract in one round-trip.
    snapshot = await page.evaluate("""
        () => ({
            renderFrameType: typeof window.__renderFrame,
            sceneReady: window.__sceneReady,
            duration: window.__duration,
            audioRuntime: window.__audioRuntime,
            audioCues: Array.isArray(window.__audioCues) ? window.__audioCues.length : null,
            recording: window.__recording === true,
            capabilities: window.__capabilities || null,
        })
    """)

    contract["__renderFrame"] = snapshot["renderFrameType"]   # 'function' or 'undefined'
    contract["__sceneReady"] = snapshot["sceneReady"]
    contract["__duration"] = snapshot["duration"]
    contract["__audioRuntime"] = snapshot["audioRuntime"]
    contract["__audioCues_count"] = snapshot["audioCues"]
    contract["__recording"] = snapshot["recording"]
    contract["__capabilities"] = snapshot["capabilities"]

    # 3D mode: __renderFrame must be callable AND __sceneReady === true.
    if args.three_d:
        if snapshot["renderFrameType"] != "function":
            result["page_contract"] = contract
            return False, "3D mode: window.__renderFrame is not a function"
        # __sceneReady can flip true asynchronously after __ready. give it a beat.
        try:
            await page.wait_for_function(
                "window.__sceneReady === true",
                timeout=min(timeout_ms, 30000),
            )
            contract["__sceneReady"] = True
        except Exception:
            result["page_contract"] = contract
            return False, "3D mode: window.__sceneReady never became true"

    # audio mode: __audioRuntime must be one of the allowed strings.
    if args.audio:
        allowed = ("static", "tone", "wam2")
        ar = snapshot["audioRuntime"]
        # grace: if exposed as object (legacy { ctx, masterGain }), treat as 'tone'.
        # we still record what we saw.
        if isinstance(ar, str):
            if ar not in allowed:
                result["page_contract"] = contract
                return False, f"audio mode: __audioRuntime='{ar}' not in {allowed}"
        elif ar is None:
            result["page_contract"] = contract
            return False, "audio mode: __audioRuntime is undefined"
        else:
            # non-string truthy. accept but flag.
            contract["__audioRuntime_note"] = "non-string runtime accepted (legacy object form)"

    # __duration: number > 0 (or override). only enforced if claimed/overridden.
    expected_duration = args.duration if args.duration is not None else snapshot["duration"]
    if expected_duration is not None:
        try:
            d = float(expected_duration)
        except (TypeError, ValueError):
            result["page_contract"] = contract
            return False, f"__duration not a number: {expected_duration!r}"
        if d <= 0:
            result["page_contract"] = contract
            return False, f"__duration must be > 0, got {d}"
        contract["__duration_resolved"] = d

    # 3D smoke: call __renderFrame(0) to confirm it doesn't throw.
    if args.three_d:
        try:
            await page.evaluate("() => { window.__renderFrame(0); }")
            contract["__renderFrame_smoke"] = "ok"
        except Exception as e:
            contract["__renderFrame_smoke"] = f"threw: {e}"
            result["page_contract"] = contract
            return False, f"3D mode: __renderFrame(0) threw: {e}"

    result["page_contract"] = contract
    return True, ""


# ============================================================================
# ASSET_CHECKS - images, fonts
# ============================================================================

async def assert_assets(page, result):
    # imgs: every <img> must have naturalWidth > 0. broken src -> 0.
    img_check = await page.evaluate("""
        () => {
            const imgs = Array.from(document.images || []);
            const total = imgs.length;
            let loaded = 0;
            const broken = [];
            for (const img of imgs) {
                if (img.complete && img.naturalWidth > 0) {
                    loaded += 1;
                } else {
                    broken.push({
                        src: img.currentSrc || img.src || '',
                        complete: img.complete,
                        naturalWidth: img.naturalWidth,
                    });
                }
            }
            return { total, loaded, broken };
        }
    """)
    result["checks"]["images_loaded"] = f"{img_check['loaded']}/{img_check['total']}"
    if img_check["broken"]:
        result["checks"]["broken_images"] = img_check["broken"]
        return False, f"{len(img_check['broken'])} image(s) failed to load"

    # fonts: document.fonts.ready resolves. should already be done after __ready,
    # but assert it explicitly so missing webfonts fail loudly.
    try:
        fonts_ok = await page.evaluate("""
            async () => {
                if (!document.fonts || !document.fonts.ready) return true;
                await document.fonts.ready;
                return document.fonts.status === 'loaded';
            }
        """)
        result["checks"]["fonts_loaded"] = bool(fonts_ok)
        if not fonts_ok:
            return False, "document.fonts.ready resolved but status != 'loaded'"
    except Exception as e:
        result["checks"]["fonts_loaded"] = False
        return False, f"font readiness check threw: {e}"

    # network 4xx/5xx that already happened: any failed request that's not a
    # known noise source (favicon.ico, devtools probes) fails the asset gate.
    noise = ("favicon.ico",)
    real_failures = [
        r for r in result["failed_requests"]
        if not any(n in r["url"] for n in noise)
    ]
    if real_failures:
        result["checks"]["network_failures"] = real_failures
        return False, f"{len(real_failures)} network request(s) returned 4xx/5xx"

    return True, ""


# ============================================================================
# REPORT - screenshot + json + stdout summary
# ============================================================================

async def maybe_screenshot(page, args, result):
    # write end-state shot if user asked. full page so long pages aren't cropped.
    if not args.screenshot:
        return
    try:
        out = Path(args.screenshot).resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(out), full_page=True)
        result["screenshot"] = str(out)
    except Exception as e:
        # screenshot failure is reported but doesn't fail the gate.
        result["checks"]["screenshot_error"] = str(e)


def write_output(result, output_path):
    if not output_path:
        return
    try:
        out = Path(output_path).resolve()
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, default=str)
    except Exception as e:
        print(f"WARN: failed to write --output JSON: {e}", file=sys.stderr)


def print_summary(result):
    print("=" * 60)
    print(f"verify.py: {result['input']}")
    print("=" * 60)
    status = "PASS" if result["passed"] else "FAIL"
    print(f"status      : {status}")
    print(f"exit_code   : {result['exit_code']}")
    if result.get("exit_reason"):
        print(f"reason      : {result['exit_reason']}")
    print(f"duration    : {result['duration_sec']}s")

    contract = result.get("page_contract", {})
    if contract:
        print("page contract:")
        for k in ("__ready", "__sceneReady", "__renderFrame",
                  "__duration", "__audioRuntime", "__recording"):
            if k in contract:
                print(f"  {k:18s} = {contract[k]}")

    checks = result.get("checks", {})
    if checks:
        print("checks:")
        for k, v in checks.items():
            print(f"  {k:18s} = {v}")

    if result.get("page_errors"):
        print(f"page errors ({len(result['page_errors'])}):")
        for e in result["page_errors"][:10]:
            print(f"  - {e}")

    if result.get("errors"):
        print(f"console errors ({len(result['errors'])}):")
        for e in result["errors"][:10]:
            print(f"  - [{e['type']}] {e['text']}")

    if result.get("warnings"):
        print(f"console warnings ({len(result['warnings'])}):")
        for w in result["warnings"][:5]:
            print(f"  - [{w['type']}] {w['text']}")

    if result.get("screenshot"):
        print(f"screenshot  : {result['screenshot']}")
    print("=" * 60)


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        exit_code, result = asyncio.run(run_verify(args))
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        return 130

    if result is None:
        # early-exit path (missing playwright, missing file). already printed.
        return exit_code

    print_summary(result)
    write_output(result, args.output)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
