// Render exact editorial labels; no generated or reconstructed product screens.
import Foundation
import AppKit
let _ = NSApplication.shared
let args = CommandLine.arguments
if args.count != 4 { fatalError("Usage: render-header output.png chapter label") }
let image = NSImage(size: NSSize(width:1920,height:72))
image.lockFocus()
NSColor(calibratedRed:0.055,green:0.12,blue:0.115,alpha:1).setFill()
NSBezierPath(rect:NSRect(x:0,y:0,width:1920,height:72)).fill()
func text(_ value:String,_ x:CGFloat,_ size:CGFloat,_ color:NSColor = .white) {
 let attrs:[NSAttributedString.Key:Any] = [.font:NSFont.systemFont(ofSize:size,weight:.medium),.foregroundColor:color]
 (value as NSString).draw(at:NSPoint(x:x,y:22),withAttributes:attrs)
}
text("AgentMeter",64,26)
text(args[2],300,25)
let label = args[3]
let font = NSFont.systemFont(ofSize:19,weight:.semibold)
let width = (label as NSString).size(withAttributes:[.font:font]).width
text(label,1856-width,19,NSColor(calibratedRed:0.73,green:0.87,blue:0.81,alpha:1))
image.unlockFocus()
let bitmap = NSBitmapImageRep(data:image.tiffRepresentation!)!
try bitmap.representation(using:.png,properties:[:])!.write(to:URL(fileURLWithPath:args[1]))
