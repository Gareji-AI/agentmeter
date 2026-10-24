"""Assemble actual screen-recorded clips; never reconstruct product screens."""
import argparse, json, subprocess, concurrent.futures
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument('folder',type=Path)
args=parser.parse_args()
root=args.folder.resolve(); repo=Path(__file__).resolve().parents[2]
plan=json.loads((repo/'docs/video/demo-plan.json').read_text())
edits=json.loads((repo/'docs/video/edit-list.json').read_text())
for folder in ['edit','graphics','delivery']:(root/folder).mkdir(exist_ok=True)
header=root/'render-header'
if not header.exists():subprocess.run(['xcrun','swiftc',str(repo/'scripts/video/render-header.swift'),'-o',str(header)],check=True)
work=[]
for scene,timing in zip(edits['scenes'],plan['scenes'],strict=True):
    assert scene['id']==timing['id']
    assert sum(c[2] for c in scene['cuts'])==timing['end']-timing['start']
    graphic=root/'graphics'/(scene['id']+'.png')
    subprocess.run([str(header),str(graphic),scene['title'],scene['label']],check=True)
    for i,(file,start,duration) in enumerate(scene['cuts']):
        work.append((scene['id'],i,root/'raw'/file,start,duration,graphic,root/'edit'/f"{scene['id']}-{i}.mp4"))
def render(job):
    scene,i,source,start,duration,graphic,out=job
    filters=f'[0:v]fps=30,scale=1792:1008:flags=lanczos,setsar=1,pad=1920:1080:64:72:color=0x0e1f1d[v];[1:v]scale=1920:72[h];[v][h]overlay=0:0:eof_action=repeat,tpad=stop_mode=clone:stop_duration=1,trim=duration={duration},setpts=PTS-STARTPTS[out]'
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-ss',str(start),'-i',str(source),'-i',str(graphic),'-filter_complex',filters,'-map','[out]','-an','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','18','-threads','2','-pix_fmt','yuv420p','-video_track_timescale','90000','-movflags','+faststart','-y',str(out)],check=True)
    return f'Rendered {scene}/{i}'
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for result in pool.map(render,work):print(result,flush=True)
listing=root/'edit/concat.txt'
listing.write_text(''.join("file '"+str(job[-1]).replace("'","'\\''")+"'\n" for job in work))
out=root/'delivery/agentmeter-screen-only.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',str(listing),'-c','copy','-movflags','+faststart','-y',str(out)],check=True)
metadata=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate','-of','json',str(out)]))
assert len(metadata['streams'])==1 and metadata['streams'][0]['codec_type']=='video'
assert metadata['streams'][0]['width']==1920 and metadata['streams'][0]['height']==1080
assert abs(float(metadata['format']['duration'])-170)<0.1
(root/'delivery/media-check.json').write_text(json.dumps({'pass':True,'expected_seconds':170,'source':'Actual Chrome window recordings, hard cuts, normal speed; no audio recorded','probe':metadata},indent=2))
print('PASS: 170-second 1080p silent screen master; actual recorded UI only.',flush=True)
