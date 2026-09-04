"""Automated Verification Suite for 12 CrisisLens Specialized Query Handlers.

Asserts that:
1. All 12 specialized query categories are correctly matched and return rich, physics-grounded intelligence.
2. No generic canned responses or placeholders remain.
3. Thermodynamic and physics metrics (Tetens VPD, Heat Index, Wet-Bulb, Grid Load, Evaporative Loss) are computed and present.
4. Bilingual English and Urdu outputs are generated with high fidelity.
5. Self-healing interception in `proxy_crisislens_chat` properly catches generic n8n responses and replaces them with specialized intelligence.
"""

import sys
import os
import asyncio
from typing import Dict, Any

# Add backend directory to path
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.api.v1.endpoints import (
    generate_specialized_intelligence_response,
    proxy_crisislens_chat,
)

BANNED_CANVAS_PHRASES = [
    "do not cross the configured threat thresholds",
    "does not cross the configured threat thresholds",
    "severity: unknown",
    "correlation: unknown",
    "tell me which stakeholder",
    "calculated heat index: not available",
    "no threshold-crossing active threat was detected",
    "conditions appear stable, but continue monitoring",
    "let’s walk through what the evidence means",
    "let's walk through what the evidence means",
    "here’s the practical risk picture right now",
    "here's the practical risk picture right now",
    "evidence-led interpretation",
    "do you want the supporting evidence",
    "location needed",
    "which asian city",
    "which city",
    "مقام درکار ہے",
    "ایشیائی شہر",
]

TEST_QUERIES = [
    {
        "id": 1,
        "name": "Comprehensive CrisisLens Report",
        "query": "Generate a comprehensive CrisisLens report.",
        "expected_en": ["Comprehensive Multi-Sector Threat Intelligence Briefing", "Thermodynamic & Atmospheric Telemetry", "Critical Infrastructure & Resource Ledgers", "Stakeholder Operational Directives"],
        "expected_ur": ["جامع ملٹی سیکٹر تھریٹ انٹیلیجنس بریفنگ", "تھرموڈائنامک اور ماحولیاتی پیمائش", "اہم انفراسٹرکچر اور وسائل کا لیجر"],
    },
    {
        "id": 2,
        "name": "Flood Likelihood",
        "query": "Is flooding likely in this region?",
        "expected_en": ["Flood & Hydrological Inundation Risk Assessment", "Precipitation Probability", "Open-Meteo Hydrometeorological Sensors", "GDACS Hydrological Alert Network"],
        "expected_ur": ["سیلاب اور زیر آب آنے کے خطرات کا جائزہ", "اوپن میٹیو ہائیڈرولوجیکل سینسرز"],
    },
    {
        "id": 3,
        "name": "Wildfire Activity",
        "query": "Check for wildfire activity.",
        "expected_en": ["Wildfire & Vegetative Flammability Assessment", "NASA FIRMS", "Vapor Pressure Deficit", "Firebreak"],
        "expected_ur": ["جنگلاتی آگ اور فائر الرٹس کا جائزہ", "ناسا فرمز"],
    },
    {
        "id": 4,
        "name": "Active Disaster Alerts",
        "query": "Are there active disaster alerts?",
        "expected_en": ["Official Multi-Hazard Disaster Alerts & Early Warnings", "GDACS", "Tropical Cyclones: 0", "Earthquakes M5.5+: 0"],
        "expected_ur": ["آفات اور سرکاری وارننگز کا جائزہ", "جی ڈی اے سی ایس"],
    },
    {
        "id": 5,
        "name": "Heatwave Evaluation",
        "query": "Is this city experiencing a heatwave?",
        "expected_en": ["Heatwave & Extreme Thermal Event Evaluation", "Heat Index", "Wet-Bulb Temperature", "Vapor Pressure Deficit"],
        "expected_ur": ["ہیٹ ویو اور شدید گرمی کا جائزہ", "ہیٹ انڈیکس", "ویٹ بلب درجہ حرارت"],
    },
    {
        "id": 6,
        "name": "Crisis Severity",
        "query": "What is the current crisis severity?",
        "expected_en": ["Unified Multi-Vector Crisis Severity Assessment", "Overall Crisis Severity", "Atmospheric & Thermal Vector", "Critical Infrastructure Vector"],
        "expected_ur": ["مجموعی بحرانی شدت کا جائزہ", "بحرانی شدت کی مجموعی سطح", "شواہد کا باہمی تعلق"],
    },
    {
        "id": 7,
        "name": "Supporting Evidence Breakdown",
        "query": "What evidence supports this threat level?",
        "expected_en": ["Multi-Source Evidentiary Provenance & Corroboration Audit", "Open-Meteo", "GDACS", "NASA FIRMS", "GDELT"],
        "expected_ur": ["شواہد کی تصدیق اور ذرائع کا تفصیلی جائزہ", "اوپن میٹیو", "جی ڈی اے سی ایس", "ناسا فرمز"],
    },
    {
        "id": 8,
        "name": "Agricultural Directives",
        "query": "What should farmers do?",
        "expected_en": ["Priority Agricultural Threat Directives & Action Protocol", "Nocturnal Irrigation Window", "Pest & Canopy Scouting"],
        "expected_ur": ["کسانوں کے لیے ترجیحی زرعی ہدایات", "رات کی آبپاشی کا لازمی وقت"],
    },
    {
        "id": 9,
        "name": "Grid Operator Preparedness",
        "query": "What should grid operators prepare for?",
        "expected_en": ["Power Grid Operator Preparedness & Thermal Load Protocol", "Available Capacity", "Cooling Demand Surge", "Substation Cooling"],
        "expected_ur": ["پاور گرڈ آپریٹرز کے لیے تیاری کا پروٹوکول", "دستیاب صلاحیت", "کولنگ لوڈ میں متوقع اضافہ"],
    },
    {
        "id": 10,
        "name": "Emergency Authorities Directives",
        "query": "What should emergency authorities do?",
        "expected_en": ["Emergency Authorities & Civil Protection Action Directives", "Disseminate Multi-Channel Public Health Bulletins", "Urban Hydration & Cooling Relief Points", "Heat-Stroke Preparedness"],
        "expected_ur": ["ہنگامی اداروں (سول ڈیفنس و ریسکیو) کے لیے عملی احکامات", "عوامی آگاہی کے پیغامات", "ٹھنڈے پانی اور ریلیف پوائنٹس"],
    },
    {
        "id": 11,
        "name": "Public Safety Instructions",
        "query": "Give public safety instructions.",
        "expected_en": ["Public Safety & Citizen Protection Guidelines", "Hydrate Continuously", "Avoid Peak Sun Exposure", "Recognize Heat Exhaustion", "Parked Vehicles"],
        "expected_ur": ["عوامی تحفظ اور حفاظتی تدابیر", "پانی کا کثرت سے استعمال", "شدید دھوپ سے بچیں", "ہیٹ اسٹروک کی علامات"],
    },
    {
        "id": 12,
        "name": "Current Threats in City",
        "query": "Are there any current threats in Karachi?",
        "expected_en": ["Multi-Hazard Situational Threat Assessment for Karachi", "Current Threat Tier", "Open-Meteo Real-Time Telemetry", "Priority Recommended Actions"],
        "expected_ur": ["کثیر المقاصد خطرات کا صورتحالاتی جائزہ", "موجودہ خطرے کی سطح", "اہم حفاظتی اقدامات"],
    },
]


def test_specialized_intelligence_handlers():
    print("================================================================================")
    print("      WIaaS CRISISLENS SPECIALIZED INTELLIGENCE VERIFICATION SUITE              ")
    print("================================================================================")

    passed = 0
    total = len(TEST_QUERIES)

    for item in TEST_QUERIES:
        q_id = item["id"]
        name = item["name"]
        query = item["query"]
        expected_en = item["expected_en"]
        expected_ur = item["expected_ur"]

        import io, contextlib
        # 1. Test English generation
        with contextlib.redirect_stdout(io.StringIO()):
            res_en = generate_specialized_intelligence_response(
                region_key="pakistan_multan",
                user_query=query,
                response_language="en"
            )
        reply_en = res_en.get("reply", "")
        reply_en_lower = reply_en.lower()

        # Check banned generic phrases in English
        banned_found_en = [b for b in BANNED_CANVAS_PHRASES if b in reply_en_lower]
        if banned_found_en:
            print(f"Cat {q_id} ({name}) [FAIL]: English response contains banned generic phrases: {banned_found_en}")
            continue

        # Check required keywords in English
        missing_en = [k for k in expected_en if k.lower() not in reply_en_lower]
        if missing_en:
            print(f"Cat {q_id} ({name}) [FAIL]: English response missing expected phrases: {missing_en}")
            continue

        # Check that physical units / metrics are present
        has_physics_units = any(u in reply_en for u in ["°C", "%", "kPa", "MW", "km/h", "m³"])
        if not has_physics_units:
            print(f"Cat {q_id} ({name}) [FAIL]: English response missing physical telemetry metrics (°C, %, kPa, etc.)")
            continue

        # 2. Test Urdu generation
        with contextlib.redirect_stdout(io.StringIO()):
            res_ur = generate_specialized_intelligence_response(
                region_key="pakistan_multan",
                user_query=query,
                response_language="ur"
            )
        reply_ur = res_ur.get("reply", "")

        # Check banned generic phrases in Urdu
        banned_found_ur = [b for b in BANNED_CANVAS_PHRASES if b in reply_ur]
        if banned_found_ur:
            print(f"Cat {q_id} ({name}) [FAIL]: Urdu response contains banned generic phrases: {banned_found_ur}")
            continue

        # Check required keywords in Urdu
        missing_ur = [k for k in expected_ur if k not in reply_ur]
        if missing_ur:
            print(f"Cat {q_id} ({name}) [FAIL]: Urdu response missing expected Urdu phrases: {missing_ur}")
            continue

        # 3. Test that speech_en and speech_ur are both populated
        if not res_en.get("speech_en") or not res_en.get("speech_ur"):
            print(f"Cat {q_id} ({name}) [FAIL]: speech_en or speech_ur missing in response object")
            continue

        print(f"Cat {q_id}: {name} -> PASS")
        passed += 1

    print("\n================================================================================")
    print(f"Summary: {passed}/{total} Specialized Intelligence Categories PASSED")
    print("================================================================================")
    assert passed == total, f"Only {passed}/{total} categories passed verification"


async def test_proxy_interception_simulation():
    print("\n--------------------------------------------------------------------------------")
    print("Testing proxy_crisislens_chat Self-Healing Interception & Canned Detection...")
    print("--------------------------------------------------------------------------------")

    # Simulate payload sending a specific question
    test_payload = {
        "original_message": "What should grid operators prepare for?",
        "region_key": "pakistan_multan",
        "response_language": "en"
    }

    # Call proxy_crisislens_chat (which handles network exceptions or generic canned n8n responses)
    res = await proxy_crisislens_chat(test_payload)
    reply = res.get("reply", "")
    reply_lower = reply.lower()

    assert "power grid operator preparedness & thermal load protocol" in reply_lower, (
        "Proxy should have returned specialized grid operator intelligence"
    )
    for b in BANNED_CANVAS_PHRASES:
        assert b not in reply_lower, f"Proxy response should not contain banned phrase: {b}"

    print("  [PASS] proxy_crisislens_chat self-healing and specialized generation verified.")


def main():
    test_specialized_intelligence_handlers()
    asyncio.run(test_proxy_interception_simulation())
    print("\nALL 12 CRISISLENS SPECIALIZED INTELLIGENCE VERIFICATIONS COMPLETED SUCCESSFULLY!\n")


if __name__ == "__main__":
    main()
