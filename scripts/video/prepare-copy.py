"""Build matching local presenter copy, optional subtitles and an offline rehearsal player."""
import argparse,json,re,textwrap,html
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('folder',type=Path);a=p.parse_args()
repo=Path(__file__).resolve().parents[2];plan=json.loads((repo/'docs/video/demo-plan.json').read_text())
out=a.folder/'delivery';out.mkdir(exist_ok=True)
def clock(s):return f'{int(s)//60:01}:{int(s)%60:02}'
def stamp(s):
 n=round(s*1000);return f'{n//3600000:02}:{n//60000%60:02}:{n//1000%60:02},{n%1000:03}'
voice='\n\n'.join(f"[{clock(s['start'])}–{clock(s['end'])}] {s['id'].upper()}\n{s['narration']}" for s in plan['scenes'])+'\n'
(out/'narration-english.txt').write_text(voice)
(repo/'docs/video/narration-english.txt').write_text(voice)
subs=[]
for scene in plan['scenes']:
 sentences=re.split(r'(?<=[.!?])\s+',scene['narration'])
 total=sum(len(s.split()) for s in sentences);at=scene['start']
 for sentence in sentences:
  duration=(scene['end']-scene['start'])*len(sentence.split())/total
  subs.append(f'{len(subs)+1}\n{stamp(at)} --> {stamp(at+duration-0.08)}\n'+textwrap.fill(sentence,55)+'\n')
  at+=duration
(out/'narration-english.srt').write_text('\n'.join(subs))
# This player runs from a local file; no network, recording, credentials or uploads.
data=json.dumps(plan,ensure_ascii=False).replace('</','<\\/')
page='''<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AgentMeter · presenter rehearsal</title>
<style>body{margin:0;background:#102421;color:#eef4f1;font:18px system-ui}header{padding:20px 30px;border-bottom:1px solid #45615b;display:flex;justify-content:space-between}main{display:grid;grid-template-columns:60% 40%;gap:20px;padding:24px;box-sizing:border-box}video{width:100%;background:#000}button{background:#bde8d0;color:#102421;border:0;border-radius:8px;font:inherit;padding:10px 14px;cursor:pointer;margin:12px 8px 0 0}#script{font-size:29px;line-height:1.55}h2{font-size:17px;color:#bde8d0;text-transform:uppercase}.help{font-size:16px;color:#b1c5be;line-height:1.7}#time{font-variant-numeric:tabular-nums}@media(max-width:950px){main{grid-template-columns:1fr}#script{font-size:24px}}</style>
<header><strong>AgentMeter · 英語ナレーション練習</strong><span id="time">0:00 / TOTAL_TIME</span></header><main><section><video id="movie" controls preload="metadata" src="agentmeter-screen-only.mp4"></video><button id="start">最初から再生</button><button id="pause">停止 / 再開</button><button id="previous">前の章</button><button id="next">次の章</button><p class="help">無音の操作動画です。右の英語が現在の章に合わせて変わります。<br>本番は顔と声だけを撮影し、章ごとに撮り直しても大丈夫です。<br>音楽・カメラ・マイク・アップロード機能はありません。素材はローカルにあります。</p></section><section><h2 id="chapter"></h2><div id="script"></div></section></main><script>const plan=PLAN;const v=document.querySelector('#movie');let selected=0;function update(){selected=plan.scenes.findIndex(s=>v.currentTime>=s.start&&v.currentTime<s.end);if(selected<0)selected=plan.scenes.length-1;const s=plan.scenes[selected];document.querySelector('#chapter').textContent=`${s.id} · ${Math.floor(s.start/60)}:${String(s.start%60).padStart(2,'0')} – ${Math.floor(s.end/60)}:${String(s.end%60).padStart(2,'0')}`;document.querySelector('#script').textContent=s.narration;document.querySelector('#time').textContent=`${Math.floor(v.currentTime/60)}:${String(Math.floor(v.currentTime%60)).padStart(2,'0')} / TOTAL_TIME`;}v.addEventListener('timeupdate',update);document.querySelector('#start').onclick=()=>{v.currentTime=0;v.play()};document.querySelector('#pause').onclick=()=>v.paused?v.play():v.pause();document.querySelector('#previous').onclick=()=>{v.currentTime=plan.scenes[Math.max(0,selected-1)].start;update()};document.querySelector('#next').onclick=()=>{v.currentTime=plan.scenes[Math.min(plan.scenes.length-1,selected+1)].start;update()};update();</script></html>'''.replace('PLAN',data).replace('TOTAL_TIME',clock(plan['target_seconds']))
(out/'presenter-rehearsal.html').write_text(page)
print('Wrote English copy, optional SRT and offline rehearsal player.')
