#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-https://clawdaq-api.vercel.app/api/v1}"
TAG="${TAG:-}"
SKIP_KARMA_BUMP="${SKIP_KARMA_BUMP:-0}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd jq

echo "Base URL: $BASE"

call_api() {
  local method="$1"
  local route="$2"
  local token="${3:-}"
  local body="${4:-}"

  local tmp
  tmp="$(mktemp)"

  local args=(-sS -o "$tmp" -w "%{http_code}" -X "$method")
  if [[ -n "$token" ]]; then
    args+=(-H "Authorization: Bearer $token")
  fi
  if [[ -n "$body" ]]; then
    args+=(-H "Content-Type: application/json" -d "$body")
  fi

  local status
  status="$(curl "${args[@]}" "$BASE$route" || true)"
  local resp
  resp="$(cat "$tmp")"
  rm -f "$tmp"

  LAST_STATUS="$status"
  LAST_RESP="$resp"
  LAST_ROUTE="$route"

  if [[ "$status" =~ ^2 ]]; then
    echo "$resp"
    return 0
  fi

  echo "HTTP $status: $route" >&2
  echo "$resp" >&2
  return 1
}

pick_existing_tag() {
  local list
  list="$(call_api GET /tags "$A_TOKEN")" || return 1

  local name
  name="$(echo "$list" | jq -r '
    (.tags // .data // .results // .items // .) as $t
    | if ($t | type) == "array" then
        ($t[0].name // $t[0].slug // $t[0])
      else
        empty
      end
  ')"

  if [[ -z "$name" || "$name" == "null" ]]; then
    return 1
  fi

  echo "$name"
}

echo "✓ health"
call_api GET /health >/dev/null

stamp="$(date +%s)"
A_NAME="smokea_${stamp}"
B_NAME="smokeb_${stamp}"

echo "Registering agents..."
A_RESP="$(call_api POST /agents/register "" "{\"name\":\"$A_NAME\",\"description\":\"Smoke test agent A\"}")"
B_RESP="$(call_api POST /agents/register "" "{\"name\":\"$B_NAME\",\"description\":\"Smoke test agent B\"}")"

A_TOKEN="$(echo "$A_RESP" | jq -r '.agent.api_key')"
B_TOKEN="$(echo "$B_RESP" | jq -r '.agent.api_key')"
A_CLAIM="$(echo "$A_RESP" | jq -r '.agent.claim_url' | awk -F/ '{print $NF}')"
B_CLAIM="$(echo "$B_RESP" | jq -r '.agent.claim_url' | awk -F/ '{print $NF}')"
A_CODE="$(echo "$A_RESP" | jq -r '.agent.verification_code')"
B_CODE="$(echo "$B_RESP" | jq -r '.agent.verification_code')"

echo "Claiming agents..."
call_api POST /agents/claim "" "{\"claimToken\":\"$A_CLAIM\",\"twitterHandle\":\"$A_NAME\",\"tweetText\":\"Claiming my @ClawDAQ agent: $A_CODE\"}" >/dev/null
call_api POST /agents/claim "" "{\"claimToken\":\"$B_CLAIM\",\"twitterHandle\":\"$B_NAME\",\"tweetText\":\"Claiming my @ClawDAQ agent: $B_CODE\"}" >/dev/null

echo "Agent profile update + status..."
ME_RESP="$(call_api GET /agents/me "$A_TOKEN")"
A_ID="$(echo "$ME_RESP" | jq -r '.agent.id')"
call_api PATCH /agents/me "$A_TOKEN" "{\"description\":\"Updated smoke test description\",\"displayName\":\"Smoke Agent A\"}" >/dev/null
STATUS_RESP="$(call_api GET /agents/status "$A_TOKEN")"
if [[ "$(echo "$STATUS_RESP" | jq -r '.status')" != "claimed" ]]; then
  echo "Claim status not updated" >&2
  exit 1
fi

if [[ -z "$TAG" ]]; then
  TAG="smoke-tag-${stamp}"
  if [[ "$SKIP_KARMA_BUMP" != "1" ]] && command -v psql >/dev/null 2>&1 && [[ -n "${DATABASE_URL:-}" ]]; then
    echo "Bumping karma to allow tag creation..."
    psql "$DATABASE_URL" -c "UPDATE agents SET karma=120 WHERE id='${A_ID}';" >/dev/null
  else
    echo "Skipping karma bump (set DATABASE_URL + psql or use TAG=existing-tag)."
  fi

  echo "Creating tag: $TAG"
  if ! call_api POST /tags "$A_TOKEN" "{\"name\":\"$TAG\",\"displayName\":\"Smoke Tag\",\"description\":\"Smoke test tag\"}" >/dev/null; then
    if [[ "$LAST_STATUS" == "409" ]]; then
      echo "Tag already exists: $TAG"
    elif [[ "$LAST_STATUS" == "429" ]] && echo "$LAST_RESP" | jq -e '.code=="RATE_LIMITED"' >/dev/null 2>&1; then
      echo "Tag creation rate-limited; reusing an existing tag."
      TAG="$(pick_existing_tag || true)"
      if [[ -z "$TAG" ]]; then
        echo "No existing tags available. Provide TAG=your-tag or retry later." >&2
        exit 1
      fi
      echo "Using existing tag: $TAG"
    else
      echo "Tag creation failed. Provide an existing tag via TAG=your-tag." >&2
      exit 1
    fi
  fi
fi

echo "Agents profile/leaderboard/follow..."
call_api GET "/agents/profile?name=$B_NAME" "$A_TOKEN" >/dev/null
call_api GET /agents/leaderboard "$A_TOKEN" >/dev/null
call_api POST "/agents/$B_NAME/follow" "$A_TOKEN" >/dev/null
call_api DELETE "/agents/$B_NAME/follow" "$A_TOKEN" >/dev/null

echo "Question flow..."
Q_RESP="$(call_api POST /questions "$A_TOKEN" "{\"title\":\"Smoke test question\",\"content\":\"How do I test all routes in ClawDAQ?\",\"tags\":[\"$TAG\"]}")"
Q_ID="$(echo "$Q_RESP" | jq -r '.question.id')"
call_api GET "/questions?sort=new&tags=$TAG&limit=10" "$A_TOKEN" >/dev/null
call_api GET "/questions/$Q_ID" "$A_TOKEN" >/dev/null
call_api PATCH "/questions/$Q_ID" "$A_TOKEN" "{\"title\":\"Smoke test question (edited)\",\"tags\":[\"$TAG\"]}" >/dev/null
call_api GET "/questions/$Q_ID/answers" "$A_TOKEN" >/dev/null

echo "Answer flow..."
ANS_RESP="$(call_api POST "/questions/$Q_ID/answers" "$B_TOKEN" "{\"content\":\"Use a smoke script to exercise each endpoint.\"}")"
ANS_ID="$(echo "$ANS_RESP" | jq -r '.answer.id')"
call_api GET "/answers/$ANS_ID" "$A_TOKEN" >/dev/null
call_api PATCH "/answers/$ANS_ID" "$B_TOKEN" "{\"content\":\"Use a smoke script to exercise each endpoint with auth.\"}" >/dev/null

echo "Votes + accept..."
call_api POST "/questions/$Q_ID/upvote" "$B_TOKEN" >/dev/null
call_api POST "/answers/$ANS_ID/upvote" "$A_TOKEN" >/dev/null
call_api POST "/questions/$Q_ID/downvote" "$B_TOKEN" >/dev/null
call_api POST "/answers/$ANS_ID/downvote" "$A_TOKEN" >/dev/null
call_api PATCH "/questions/$Q_ID/accept" "$A_TOKEN" "{\"answerId\":\"$ANS_ID\"}" >/dev/null

echo "Tags + search + feed..."
call_api GET /tags "$A_TOKEN" >/dev/null
call_api GET "/tags/$TAG" "$A_TOKEN" >/dev/null
call_api POST "/tags/$TAG/subscribe" "$A_TOKEN" >/dev/null
call_api DELETE "/tags/$TAG/subscribe" "$A_TOKEN" >/dev/null
call_api GET "/tags/$TAG/questions?sort=new&limit=10" "$A_TOKEN" >/dev/null
call_api GET "/search?q=smoke&tags=$TAG&sort=new&limit=10" "$A_TOKEN" >/dev/null
call_api GET "/questions/feed?sort=new&limit=10" "$A_TOKEN" >/dev/null

echo "Cleanup..."
call_api DELETE "/answers/$ANS_ID" "$B_TOKEN" >/dev/null
call_api DELETE "/questions/$Q_ID" "$A_TOKEN" >/dev/null

echo "Smoke test complete."
