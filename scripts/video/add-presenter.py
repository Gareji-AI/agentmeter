"""Local composition only. Requires the user's supplied presenter video and real mic audio."""
import argparse,json,subprocess
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--screen',type=Path,required=True)
p.add_argument('--presenter',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
p.add_argument('--trim-start',type=float,default=0,help='Seconds to trim from presenter lead-in')
a=p.parse_args()
if a.trim_start<0:raise SystemExit('trim-start must be nonnegative')
if a.output.resolve() in [a.screen.resolve(),a.presenter.resolve()]:raise SystemExit('Keep original recordings; choose a new output path')
if a.output.exists():raise SystemExit('Output already exists; choose another filename')
def probe(path):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration:stream=codec_type','-of','json',str(path)]))
screen,face=probe(a.screen),probe(a.presenter)
duration=float(screen['format']['duration'])
if not any(s['codec_type']=='audio' for s in face['streams']):raise SystemExit('Presenter recording needs the actual recorded narration audio')
if float(face['format']['duration'])-a.trim_start<duration:raise SystemExit('Presenter clip is shorter than the screen master; edit chapter takes first')
# Right lower corner, above a small bottom margin. Check important UI and move the face if needed.
filters='[1:v]scale=320:240:force_original_aspect_ratio=increase,crop=320:240,setsar=1[face];[0:v][face]overlay=x=W-w-32:y=H-h-64:shortest=1[v];[1:a]loudnorm=I=-16:TP=-1.5:LRA=11[a]'
subprocess.run(['ffmpeg','-hide_banner','-i',str(a.screen),'-ss',str(a.trim_start),'-i',str(a.presenter),'-filter_complex',filters,'-map','[v]','-map','[a]','-t',str(duration),'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-movflags','+faststart',str(a.output)],check=True)
print('Rendered local presenter composition. Inspect the entire export before publishing.')
