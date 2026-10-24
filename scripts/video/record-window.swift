import Foundation
import AppKit
import ScreenCaptureKit
import AVFoundation
import CoreMedia

final class RecorderDelegate: NSObject, SCRecordingOutputDelegate, SCStreamDelegate, @unchecked Sendable {
    var finished = false
    func recordingOutputDidStartRecording(_ output: SCRecordingOutput) { print("RECORDING_STARTED"); fflush(stdout) }
    func recordingOutput(_ output: SCRecordingOutput, didFailWithError error: Error) { print("RECORDING_FAILED: \(error.localizedDescription)"); finished = true; fflush(stdout) }
    func recordingOutputDidFinishRecording(_ output: SCRecordingOutput) { finished = true; print("RECORDING_FINISHED"); fflush(stdout) }
    func stream(_ stream: SCStream, didStopWithError error: Error) { print("STREAM_STOPPED: \(error.localizedDescription)"); fflush(stdout) }
}
@main struct WindowRecorder {
 static func main() async throws {
    let _ = NSApplication.shared
    let args = CommandLine.arguments
    guard args.count >= 3 else { throw NSError(domain:"Usage: record-window output.mp4 duration [cropTopPoints]",code:1) }
    let content = try await SCShareableContent.excludingDesktopWindows(true, onScreenWindowsOnly: false)
    let matches = content.windows.filter { $0.owningApplication?.bundleIdentifier == "com.google.Chrome" && ($0.title ?? "").contains("AgentMeter") && (args.count < 5 || String($0.windowID) == args[4]) }
    guard matches.count == 1 else { throw NSError(domain:"Select exactly one AgentMeter Chrome window; optionally pass its observed window ID after cropTopPoints",code:2) }
    let window = matches[0]
    let filter = SCContentFilter(desktopIndependentWindow: window)
    let config = SCStreamConfiguration()
    let top = args.count > 3 ? Double(args[3])! : 0
    let width = window.frame.width
    config.width = top > 0 ? 1920 : Int(width * 2)
    config.height = top > 0 ? 1080 : Int(window.frame.height * 2)
    config.sourceRect = top > 0 ? CGRect(x:0,y:top,width:width,height:width * 9 / 16) : .zero
    config.minimumFrameInterval = CMTime(value:1,timescale:30)
    config.showsCursor = true
    config.capturesAudio = false
    config.captureMicrophone = false
    config.ignoreShadowsSingleWindow = true
    config.scalesToFit = true
    let delegate = RecorderDelegate()
    let stream = SCStream(filter:filter,configuration:config,delegate:delegate)
    let outputConfig = SCRecordingOutputConfiguration()
    outputConfig.outputURL = URL(fileURLWithPath:args[1])
    outputConfig.videoCodecType = .h264
    outputConfig.outputFileType = .mp4
    let output = SCRecordingOutput(configuration:outputConfig,delegate:delegate)
    try stream.addRecordingOutput(output)
    print("TARGET \(window.windowID) \(window.frame.width)x\(window.frame.height); output \(config.width)x\(config.height); silent"); fflush(stdout)
    try await stream.startCapture()
    let duration = Double(args[2])!
    let stopFile = args[1] + ".stop"
    let end = Date().addingTimeInterval(duration)
    while Date() < end && !FileManager.default.fileExists(atPath:stopFile) { try await Task.sleep(for:.milliseconds(100)) }
    try await stream.stopCapture()
    for _ in 0..<100 { if delegate.finished {break}; try await Task.sleep(for:.milliseconds(50)) }
 }
}
