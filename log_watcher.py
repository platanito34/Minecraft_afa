#!/usr/bin/env python3
import subprocess
import re
import requests
import sys

PANEL_URL = "http://localhost:3001"
PANEL_EMAIL = "leogarcimul@gmail.com"
PANEL_PASSWORD = "DIABOL34"
CONTAINER = "25526c07-4b62-486a-bdb9-e9996aadc14e"
SERVER_ID = 1
LOG_PATH = "/home/container/logs/latest.log"

def get_token():
    r = requests.post(f"{PANEL_URL}/api/auth/login", json={
        "email": PANEL_EMAIL,
        "password": PANEL_PASSWORD
    })
    return r.json().get("token")

def record_login(token, uuid, username):
    requests.post(f"{PANEL_URL}/api/playtime/login",
        headers={"Authorization": f"Bearer {token}"},
        json={"uuid": uuid, "username": username, "server_id": SERVER_ID}
    )
    print(f"LOGIN: {username}", flush=True)

def record_logout(token, uuid):
    requests.post(f"{PANEL_URL}/api/playtime/logout",
        headers={"Authorization": f"Bearer {token}"},
        json={"uuid": uuid}
    )
    print(f"LOGOUT: {uuid}", flush=True)

def main():
    token = get_token()
    print("Watching logs...", flush=True)

    cmd = ["docker", "exec", CONTAINER, "tail", "-f", "-n", "0", LOG_PATH]
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True)

    recent_logouts = set()

    for line in process.stdout:
        line = line.strip()

        # Detectar UUID (aparece antes del join)
        uuid_line = re.search(r'UUID of player (\w+) is ([a-f0-9\-]+)', line)
        if uuid_line:
            username = uuid_line.group(1)
            uuid = uuid_line.group(2)
            recent_logouts.discard(username)
            record_login(token, uuid, username)
            continue

        # Detectar logout
        left = re.search(r'(\w+) lost connection|(\w+) left the game', line)
        if left:
            username = left.group(1) or left.group(2)
            if username in recent_logouts:
                continue
            recent_logouts.add(username)
            r = requests.get(f"{PANEL_URL}/api/players?username={username}",
                headers={"Authorization": f"Bearer {token}"})
            players = r.json()
            if players and len(players) > 0:
                record_logout(token, players[0]['uuid'])

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"ERROR: {e}", flush=True)
        sys.exit(1)
