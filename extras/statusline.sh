#!/bin/bash
# Status line: modelo · contexto · limite do plano (5h e 7 dias). Recebe o JSON da sessão no stdin.
# Cores do tema aurora; cada barra fica verde, amarela ou vermelha conforme enche.
input=$(cat)
j() { echo "$input" | jq -r "$1 // empty"; }
c() { printf '\033[38;2;%sm' "$1"; }
R=$'\033[0m'; ROXO=$(c '203;166;247'); DIM=$(c '108;112;134'); TXT=$(c '205;214;244')
cor() { [ "$1" -ge 80 ] && c '243;139;168' || { [ "$1" -ge 50 ] && c '249;226;175' || c '166;227;161'; }; }
barra() { local p=${1%.*} b='' i; for i in 1 2 3 4 5 6 7 8 9 10; do [ $((i * 10)) -le "$p" ] && b+='━' || b+="${DIM}━$(cor "$p")"; done; printf '%s%s %s%%%s' "$(cor "$p")" "$b" "$p" "$R"; }
hora() { date -r "$1" '+%H:%M'; }
dia() { date -r "$1" '+%d/%m %H:%M'; }
SEP=" ${DIM}│${R} "

out="${ROXO}✦ $(j .model.display_name)${R}"
ctx=$(j .context_window.used_percentage)
[ -n "$ctx" ] && out+="${SEP}${TXT}contexto${R} $(barra "$ctx")"
h5=$(j .rate_limits.five_hour.used_percentage)
[ -n "$h5" ] && out+="${SEP}${TXT}5h${R} $(barra "$h5") ${DIM}zera $(hora "$(j .rate_limits.five_hour.resets_at)")${R}"
d7=$(j .rate_limits.seven_day.used_percentage)
[ -n "$d7" ] && out+="${SEP}${TXT}semana${R} $(barra "$d7") ${DIM}zera $(dia "$(j .rate_limits.seven_day.resets_at)")${R}"
echo "$out"
