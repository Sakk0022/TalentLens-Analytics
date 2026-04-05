def get_status(value, param_cfg):
    direction = param_cfg.get("direction", "high")
    warn_range = param_cfg["warning"]
    crit_range = param_cfg["critical"]

    if direction == "high":
        if value >= crit_range[0]:
            return "CRITICAL"
        elif value >= warn_range[0]:
            return "WARNING"
        return "NORM"

    if value <= crit_range[1]:
        return "CRITICAL"
    elif value <= warn_range[1]:
        return "WARNING"
    return "NORM"


def normalize_external_alerts(alerts):
    normalized = []

    for alert in alerts or []:
        if isinstance(alert, str):
            normalized.append(
                {
                    "code": alert,
                    "severity": "INFO",
                    "msg": alert,
                    "recommend": None,
                    "param": None,
                    "value": None,
                    "unit": None,
                }
            )
        elif isinstance(alert, dict):
            normalized.append(
                {
                    "code": alert.get("code", "UNKNOWN"),
                    "severity": str(alert.get("severity", "INFO")).upper(),
                    "msg": alert.get("msg", ""),
                    "recommend": alert.get("recommend"),
                    "param": alert.get("param"),
                    "value": alert.get("value"),
                    "unit": alert.get("unit"),
                }
            )

    return normalized


def check_telemetry(packet: dict, profile: dict) -> dict:
    health_index = 100.0
    factors = []

    # Только входящие внешние алерты
    external_alerts = normalize_external_alerts(packet.get("alerts", []))

    # Общий список алертов: внешние + сгенерированные профилем
    all_alerts = list(external_alerts)

    params_cfg = profile["params"]

    for param_name, cfg in params_cfg.items():
        value = packet.get(param_name)
        if value is None:
            continue

        status = get_status(value, cfg)
        penalty = 0.0

        if status == "WARNING":
            penalty = float(cfg["penalty_warn"])
            all_alerts.append(
                {
                    "code": cfg["alert_code"],
                    "severity": "WARNING",
                    "param": param_name,
                    "value": value,
                    "unit": cfg["unit"],
                    "msg": cfg["alert_msg"],
                    "recommend": cfg["recommend_warn"],
                }
            )

        elif status == "CRITICAL":
            penalty = float(cfg["penalty_crit"])
            all_alerts.append(
                {
                    "code": cfg["alert_code"],
                    "severity": "CRITICAL",
                    "param": param_name,
                    "value": value,
                    "unit": cfg["unit"],
                    "msg": cfg["alert_msg"],
                    "recommend": cfg["recommend_crit"],
                }
            )

        health_index -= penalty

        factors.append(
            {
                "param": param_name,
                "label": cfg["label"],
                "value": value,
                "unit": cfg["unit"],
                "status": status,
                "penalty": penalty,
            }
        )

    # Штраф ТОЛЬКО за входящие внешние алерты
    alert_penalties = profile.get("alert_penalties", {})
    for ext_alert in external_alerts:
        sev = str(ext_alert.get("severity", "INFO")).upper()
        health_index -= float(alert_penalties.get(sev, 0))

    health_index = max(0.0, min(100.0, health_index))

    health_status = "CRITICAL"
    for status_name, cat in profile["health_categories"].items():
        if cat["min"] <= health_index <= cat["max"]:
            health_status = status_name
            break

    top_factors = sorted(
        [f for f in factors if f["penalty"] > 0],
        key=lambda x: x["penalty"],
        reverse=True,
    )[:5]

    recommendation = "Все системы в норме. Движение в штатном режиме."

    critical_alerts = [a for a in all_alerts if a["severity"] == "CRITICAL"]
    warning_alerts = [a for a in all_alerts if a["severity"] == "WARNING"]

    if critical_alerts:
        recommendation = critical_alerts[0].get("recommend") or recommendation
    elif warning_alerts:
        recommendation = warning_alerts[0].get("recommend") or recommendation

    return {
        "health_index": round(health_index, 1),
        "health_status": health_status,
        "factors": factors,
        "top_factors": top_factors,
        "alerts": all_alerts,
        "recommendation": recommendation,
    }