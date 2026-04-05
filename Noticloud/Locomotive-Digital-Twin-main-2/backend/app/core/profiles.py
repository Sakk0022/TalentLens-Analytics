PROFILE_META = {
    "KZ8A": {
        "display_name": "KZ8A Electric Locomotive",
        "resource_type": "energy",
    },
    "TE33A": {
        "display_name": "TE33A Diesel Locomotive",
        "resource_type": "fuel",
    },
}


DEFAULT_PROFILE_CONFIG = [
    # KZ8A
    {
        "locomotive_type": "KZ8A",
        "parameter": "speed_kmh",
        "warning_min": None,
        "warning_max": 120.0,
        "critical_min": None,
        "critical_max": 140.0,
        "weight": 0.15,
    },
    {
        "locomotive_type": "KZ8A",
        "parameter": "resource_level",
        "warning_min": 25.0,
        "warning_max": None,
        "critical_min": 10.0,
        "critical_max": None,
        "weight": 0.20,
    },
    {
        "locomotive_type": "KZ8A",
        "parameter": "engine_temp_c",
        "warning_min": None,
        "warning_max": 85.0,
        "critical_min": None,
        "critical_max": 95.0,
        "weight": 0.25,
    },
    {
        "locomotive_type": "KZ8A",
        "parameter": "oil_temp_c",
        "warning_min": None,
        "warning_max": 75.0,
        "critical_min": None,
        "critical_max": 85.0,
        "weight": 0.15,
    },
    {
        "locomotive_type": "KZ8A",
        "parameter": "pressure_bar",
        "warning_min": 4.5,
        "warning_max": 7.5,
        "critical_min": 3.5,
        "critical_max": 8.5,
        "weight": 0.25,
    },

    # TE33A
    {
        "locomotive_type": "TE33A",
        "parameter": "speed_kmh",
        "warning_min": None,
        "warning_max": 110.0,
        "critical_min": None,
        "critical_max": 130.0,
        "weight": 0.15,
    },
    {
        "locomotive_type": "TE33A",
        "parameter": "resource_level",
        "warning_min": 30.0,
        "warning_max": None,
        "critical_min": 15.0,
        "critical_max": None,
        "weight": 0.20,
    },
    {
        "locomotive_type": "TE33A",
        "parameter": "engine_temp_c",
        "warning_min": None,
        "warning_max": 95.0,
        "critical_min": None,
        "critical_max": 105.0,
        "weight": 0.30,
    },
    {
        "locomotive_type": "TE33A",
        "parameter": "oil_temp_c",
        "warning_min": None,
        "warning_max": 85.0,
        "critical_min": None,
        "critical_max": 95.0,
        "weight": 0.15,
    },
    {
        "locomotive_type": "TE33A",
        "parameter": "pressure_bar",
        "warning_min": 4.0,
        "warning_max": 7.0,
        "critical_min": 3.0,
        "critical_max": 8.0,
        "weight": 0.20,
    },
]