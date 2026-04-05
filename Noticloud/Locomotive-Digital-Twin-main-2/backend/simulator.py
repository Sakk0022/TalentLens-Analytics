import argparse
import asyncio
import json
import random
from datetime import datetime, timezone

import websockets


WS_URL = "ws://127.0.0.1:8000/ws/simulator"
SEND_INTERVAL = 1.0
HIGHLOAD_INTERVAL = 0.1


def train_physics(*, total_mass_tons: float, speed_kmh: float, locomotive_type: str):
    speed_ms = max(speed_kmh, 1.0) / 3.6
    total_mass_kg = total_mass_tons * 1000
    rolling_resistance_kn = (total_mass_kg * 9.81 * 0.002) / 1000
    aero_drag_kn = (0.5 * 1.225 * 0.8 * 10 * speed_ms * speed_ms) / 1000
    traction_kn = rolling_resistance_kn + aero_drag_kn
    max_traction_kn = 690 if locomotive_type == "KZ8A" else 392
    load_percent = clamp((traction_kn / max_traction_kn) * 100, 0, 99)
    fuel_per_km = None

    if locomotive_type == "TE33A":
        fuel_per_km = 1.2 * (1 + (load_percent / 100) * 1.8) * ((max(speed_kmh, 1.0) / 80) ** 1.15)

    return {
        "rolling_resistance_kn": rolling_resistance_kn,
        "aero_drag_kn": aero_drag_kn,
        "traction_kn": traction_kn,
        "max_traction_kn": max_traction_kn,
        "load_percent": load_percent,
        "fuel_per_km": fuel_per_km,
    }


def clamp(value, min_val, max_val):
    return max(min_val, min(max_val, value))


def smooth(prev, target, alpha=0.25):
    return round(alpha * target + (1 - alpha) * prev, 2)


class BaseState:
    def __init__(self, locomotive_id: str, locomotive_type: str, scenario: str):
        self.locomotive_id = locomotive_id
        self.locomotive_type = locomotive_type
        self.scenario = scenario
        self.step = 0
        self.lat = 51.18
        self.lon = 71.45

    def tick_position(self):
        self.lat = round(self.lat + random.uniform(-0.002, 0.002), 6)
        self.lon = round(self.lon + random.uniform(-0.002, 0.002), 6)


class TE33AState(BaseState):
    def __init__(self, scenario="normal"):
        super().__init__("TE33A-0089", "TE33A", scenario)

        self.speed_kmh = 76.0
        self.fuel_capacity_liters = 8000.0
        self.fuel_liters = 6000.0
        self.locomotive_mass_tons = 138.0
        self.wagons = 18
        self.cargo_tons = 1250.0
        self.rpm = 1800
        self.engine_temp_c = 88.0
        self.exhaust_temp_c = 430.0
        self.oil_temp_c = 80.0
        self.oil_pressure_bar = 4.8
        self.brake_pressure_bar = 6.3
        self.compressor_bar = 8.6
        self.voltage_aux_v = 96.0

    def set_scenario(self, scenario: str):
        self.scenario = scenario
        if scenario == "normal":
            self.wagons = 18
            self.cargo_tons = 1250.0
        elif scenario == "warning":
            self.wagons = 22
            self.cargo_tons = 1680.0
        elif scenario == "critical":
            self.wagons = 26
            self.cargo_tons = 2350.0
        else:
            self.wagons = 24
            self.cargo_tons = 1980.0

    def tick(self):
        self.step += 1
        self.tick_position()

        total_mass_tons = self.locomotive_mass_tons + self.cargo_tons + self.wagons * 22
        current_physics = train_physics(
            total_mass_tons=total_mass_tons,
            speed_kmh=self.speed_kmh,
            locomotive_type=self.locomotive_type,
        )
        load_percent = current_physics["load_percent"]
        fuel_per_km = current_physics["fuel_per_km"] or 0.0
        fuel_drop = fuel_per_km * max(self.speed_kmh, 1.0) * (SEND_INTERVAL / 3600)

        if self.scenario == "normal":
            target_speed = clamp(self.speed_kmh + random.uniform(-2, 2), 65, 90)
            target_rpm = clamp(1450 + target_speed * 4.2 + load_percent * 6 + random.uniform(-20, 20), 1500, 1900)
            target_engine_temp = clamp(76 + load_percent * 0.45 + random.uniform(-0.4, 0.4), 84, 92)
            target_exhaust_temp = clamp(320 + target_speed * 1.3 + load_percent * 2.4 + random.uniform(-8, 8), 380, 500)
            target_oil_pressure = clamp(5.2 - load_percent * 0.012 + random.uniform(-0.06, 0.06), 4.2, 5.3)
            external_alerts = []

        elif self.scenario == "warning":
            target_speed = clamp(self.speed_kmh + random.uniform(-1, 3), 85, 118)
            target_rpm = clamp(1650 + target_speed * 4.8 + load_percent * 8 + random.uniform(-15, 25), 1750, 2050)
            target_engine_temp = clamp(84 + load_percent * 0.6 + random.uniform(0.2, 0.8), 94, 103)
            target_exhaust_temp = clamp(400 + target_speed * 1.6 + load_percent * 3.4 + random.uniform(5, 15), 520, 670)
            target_oil_pressure = clamp(4.1 - load_percent * 0.02 + random.uniform(-0.05, 0.02), 2.9, 4.0)
            fuel_drop *= 1.2
            external_alerts = []
            if self.step % 6 == 0:
                external_alerts.append(
                    {
                        "code": "F001",
                        "severity": "WARNING",
                        "msg": "Температура двигателя повышена",
                        "recommend": "Снизьте нагрузку",
                    }
                )

        elif self.scenario == "critical":
            target_speed = clamp(self.speed_kmh + random.uniform(-2, 2), 95, 135)
            target_rpm = clamp(1800 + target_speed * 5.2 + load_percent * 10 + random.uniform(10, 35), 1950, 2200)
            target_engine_temp = clamp(92 + load_percent * 0.82 + self.step * 0.16 + random.uniform(0.2, 0.8), 102, 112)
            target_exhaust_temp = clamp(520 + target_speed * 1.75 + load_percent * 4.2 + self.step * 0.8 + random.uniform(8, 16), 650, 760)
            target_oil_pressure = clamp(3.9 - load_percent * 0.032 - self.step * 0.015 + random.uniform(-0.04, 0.01), 1.6, 3.0)
            fuel_drop *= 1.35
            external_alerts = [
                {
                    "code": "F001",
                    "severity": "CRITICAL",
                    "msg": "ПЕРЕГРЕВ ДВИГАТЕЛЯ",
                    "recommend": "Немедленно снизить скорость",
                },
                {
                    "code": "F002",
                    "severity": "CRITICAL",
                    "msg": "КРИТИЧЕСКОЕ ДАВЛЕНИЕ МАСЛА",
                    "recommend": "Остановить локомотив",
                },
            ]

        else:  # highload
            target_speed = clamp(self.speed_kmh + random.uniform(-2, 3), 80, 125)
            target_rpm = clamp(1600 + target_speed * 4.7 + load_percent * 8.5 + random.uniform(-15, 25), 1650, 2100)
            target_engine_temp = clamp(82 + load_percent * 0.72 + random.uniform(0.1, 0.8), 90, 108)
            target_exhaust_temp = clamp(430 + target_speed * 1.55 + load_percent * 3.8 + random.uniform(0, 15), 500, 730)
            target_oil_pressure = clamp(4.3 - load_percent * 0.022 + random.uniform(-0.08, 0.03), 2.2, 4.4)
            fuel_drop *= 1.15
            external_alerts = []
            if self.step % 10 == 0:
                external_alerts.append(
                    {
                        "code": "LOAD_TEST",
                        "severity": "INFO",
                        "msg": "Highload test marker",
                        "recommend": "None",
                    }
                )

        self.speed_kmh = smooth(self.speed_kmh, target_speed)
        self.rpm = int(smooth(self.rpm, target_rpm))
        self.engine_temp_c = smooth(self.engine_temp_c, target_engine_temp)
        self.exhaust_temp_c = smooth(self.exhaust_temp_c, target_exhaust_temp)

        oil_temp_target = clamp(self.engine_temp_c - random.uniform(5, 9), 70, 105)
        self.oil_temp_c = smooth(self.oil_temp_c, oil_temp_target)

        self.oil_pressure_bar = smooth(self.oil_pressure_bar, target_oil_pressure)
        self.brake_pressure_bar = smooth(
            self.brake_pressure_bar,
            clamp(self.brake_pressure_bar + random.uniform(-0.06, 0.06), 3.8, 6.7),
        )
        self.compressor_bar = smooth(
            self.compressor_bar,
            clamp(self.compressor_bar + random.uniform(-0.05, 0.05), 8.0, 10.8),
        )
        self.voltage_aux_v = smooth(
            self.voltage_aux_v,
            clamp(self.voltage_aux_v + random.uniform(-1.0, 0.6), 58, 102),
        )

        # Топливо только падает
        self.fuel_liters = round(max(0.0, self.fuel_liters - fuel_drop), 1)
        fuel_percent = round((self.fuel_liters / self.fuel_capacity_liters) * 100, 1)

        return {
            "locomotive_id": self.locomotive_id,
            "locomotive_type": self.locomotive_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scenario": self.scenario,
            "step": self.step,
            "speed_kmh": round(self.speed_kmh, 1),
            "fuel_liters": self.fuel_liters,
            "fuel_percent": fuel_percent,
            "rpm": self.rpm,
            "engine_temp_c": round(self.engine_temp_c, 1),
            "exhaust_temp_c": round(self.exhaust_temp_c, 1),
            "oil_temp_c": round(self.oil_temp_c, 1),
            "oil_pressure_bar": round(self.oil_pressure_bar, 2),
            "brake_pressure_bar": round(self.brake_pressure_bar, 2),
            "compressor_bar": round(self.compressor_bar, 2),
            "voltage_aux_v": round(self.voltage_aux_v, 1),
            "alerts": external_alerts,
            "lat": self.lat,
            "lon": self.lon,
        }


class KZ8AState(BaseState):
    def __init__(self, scenario="normal"):
        super().__init__("KZ8A-0001", "KZ8A", scenario)

        self.speed_kmh = 88.0
        self.locomotive_mass_tons = 200.0
        self.wagons = 22
        self.cargo_tons = 1680.0
        self.engine_temp_c = 72.0
        self.oil_temp_c = 64.0
        self.brake_pressure_bar = 6.3
        self.compressor_bar = 8.7
        self.voltage_aux_v = 98.0

    def set_scenario(self, scenario: str):
        self.scenario = scenario
        if scenario == "normal":
            self.wagons = 22
            self.cargo_tons = 1680.0
        elif scenario == "warning":
            self.wagons = 24
            self.cargo_tons = 1940.0
        elif scenario == "critical":
            self.wagons = 28
            self.cargo_tons = 2480.0
        else:
            self.wagons = 26
            self.cargo_tons = 2140.0

    def tick(self):
        self.step += 1
        self.tick_position()

        total_mass_tons = self.locomotive_mass_tons + self.cargo_tons + self.wagons * 22
        current_physics = train_physics(
            total_mass_tons=total_mass_tons,
            speed_kmh=self.speed_kmh,
            locomotive_type=self.locomotive_type,
        )
        load_percent = current_physics["load_percent"]

        if self.scenario == "normal":
            target_speed = clamp(self.speed_kmh + random.uniform(-2, 2), 75, 100)
            target_temp = clamp(58 + load_percent * 0.45 + random.uniform(-0.2, 0.3), 65, 82)
            external_alerts = []

        elif self.scenario == "warning":
            target_speed = clamp(self.speed_kmh + random.uniform(0, 3), 110, 135)
            target_temp = clamp(67 + load_percent * 0.7 + random.uniform(0.2, 0.6), 86, 94)
            external_alerts = []
            if self.step % 6 == 0:
                external_alerts.append(
                    {
                        "code": "E001",
                        "severity": "WARNING",
                        "msg": "Перегрев силового оборудования",
                        "recommend": "Снизьте нагрузку",
                    }
                )

        elif self.scenario == "critical":
            target_speed = clamp(self.speed_kmh + random.uniform(0, 4), 135, 150)
            target_temp = clamp(76 + load_percent * 0.95 + self.step * 0.12 + random.uniform(0.4, 0.9), 96, 108)
            external_alerts = [
                {
                    "code": "E001",
                    "severity": "CRITICAL",
                    "msg": "Критический перегрев силового оборудования",
                    "recommend": "Немедленно снизить тягу",
                }
            ]

        else:  # highload
            target_speed = clamp(self.speed_kmh + random.uniform(-2, 3), 90, 145)
            target_temp = clamp(63 + load_percent * 0.82 + random.uniform(0.0, 0.7), 78, 104)
            external_alerts = []
            if self.step % 10 == 0:
                external_alerts.append(
                    {
                        "code": "LOAD_TEST",
                        "severity": "INFO",
                        "msg": "Highload test marker",
                        "recommend": "None",
                    }
                )

        self.speed_kmh = smooth(self.speed_kmh, target_speed)
        self.engine_temp_c = smooth(self.engine_temp_c, target_temp)

        oil_temp_target = clamp(self.engine_temp_c - random.uniform(7, 10), 58, 94)
        self.oil_temp_c = smooth(self.oil_temp_c, oil_temp_target)

        self.brake_pressure_bar = smooth(
            self.brake_pressure_bar,
            clamp(self.brake_pressure_bar + random.uniform(-0.08, 0.04), 3.4, 6.8),
        )
        self.compressor_bar = smooth(
            self.compressor_bar,
            clamp(self.compressor_bar + random.uniform(-0.04, 0.06), 8.0, 11.4),
        )
        self.voltage_aux_v = smooth(
            self.voltage_aux_v,
            clamp(self.voltage_aux_v + random.uniform(-1.2, 0.5), 62, 105),
        )

        return {
            "locomotive_id": self.locomotive_id,
            "locomotive_type": self.locomotive_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scenario": self.scenario,
            "step": self.step,
            "speed_kmh": round(self.speed_kmh, 1),
            "fuel_liters": None,
            "fuel_percent": None,
            "rpm": None,
            "engine_temp_c": round(self.engine_temp_c, 1),
            "exhaust_temp_c": None,
            "oil_temp_c": round(self.oil_temp_c, 1),
            "oil_pressure_bar": None,
            "brake_pressure_bar": round(self.brake_pressure_bar, 2),
            "compressor_bar": round(self.compressor_bar, 2),
            "voltage_aux_v": round(self.voltage_aux_v, 1),
            "alerts": external_alerts,
            "lat": self.lat,
            "lon": self.lon,
        }


def build_state(locomotive_type: str, scenario: str):
    if locomotive_type == "TE33A":
        state = TE33AState(scenario)
    else:
        state = KZ8AState(scenario)

    state.set_scenario(scenario)
    return state


async def run_simulator(locomotive_type: str, scenario: str):
    state = build_state(locomotive_type, scenario)
    interval = HIGHLOAD_INTERVAL if scenario == "highload" else SEND_INTERVAL

    print(f"🚂 Симулятор запущен: {locomotive_type} | {scenario}")
    print(f"📡 Подключение к {WS_URL}")

    while True:
        try:
            async with websockets.connect(WS_URL) as ws:
                print("✅ WebSocket подключён")

                while True:
                    packet = state.tick()
                    await ws.send(json.dumps(packet, ensure_ascii=False))
                    print(
                        f"[{packet['step']:03d}] "
                        f"{packet['locomotive_type']} | "
                        f"{packet['scenario']:8s} | "
                        f"speed={packet['speed_kmh']:5.1f} | "
                        f"engine={packet['engine_temp_c']:5.1f} | "
                        f"alerts={len(packet['alerts'])}"
                    )
                    await asyncio.sleep(interval)

        except KeyboardInterrupt:
            print("\n🛑 Симулятор остановлен")
            break
        except Exception as e:
            print(f"⚠️ Ошибка соединения: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--type", choices=["TE33A", "KZ8A"], default="TE33A")
    parser.add_argument("--scenario", choices=["normal", "warning", "critical", "highload"], default="normal")
    args = parser.parse_args()

    asyncio.run(run_simulator(args.type, args.scenario))