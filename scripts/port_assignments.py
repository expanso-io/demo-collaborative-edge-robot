"""Map logical template services to allocated localhost endpoints."""
import os
import re


def service_port(port):
    name = "ROBOT_DASHBOARD_PORT" if port == 4180 else "ROBOT_BUS_PORT" if port == 4190 else f"ROBOT_SERVICE_{port}_PORT"
    return int(os.environ.get(name, port))


def mapped(value):
    if isinstance(value, str):
        return re.sub(r"(127\.0\.0\.1:)([0-9]+)", lambda m: m[1] + str(service_port(int(m[2]))), value)
    if isinstance(value, list):
        return [mapped(item) for item in value]
    if isinstance(value, dict):
        return {key: mapped(item) for key, item in value.items()}
    return value
