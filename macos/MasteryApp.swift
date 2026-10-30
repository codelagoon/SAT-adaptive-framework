import Cocoa
import WebKit

@main
final class MasteryApp: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private static var activeDelegate: MasteryApp?

    static func main() {
        let app = NSApplication.shared
        let delegate = MasteryApp()
        activeDelegate = delegate
        app.delegate = delegate
        app.run()
    }

    private var window: NSWindow!
    private var web: WKWebView!
    private var server: Process?
    private let runtimeInstanceID = UUID().uuidString
    private var expectedDataFile: String?
    private var attempts = 0
    private var launchFailure: String?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        let rect = NSRect(x: 0, y: 0, width: 1380, height: 900)
        window = NSWindow(contentRect: rect, styleMask: [.titled, .closable, .resizable, .miniaturizable],
                          backing: .buffered, defer: false)
        window.title = "Tenet"
        window.center()
        window.minSize = NSSize(width: 1050, height: 650)
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(self, name: "tenetAppearance")
        web = WKWebView(frame: rect, configuration: config)
        web.navigationDelegate = self
        window.contentView = web
        applyAppearance(UserDefaults.standard.string(forKey:"TenetAppearance") ?? "system")
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        showWaiting("Starting your learning workspace…")
        startRuntime()
        checkServer()
    }

    private func showWaiting(_ message: String) {
        let safe = message.replacingOccurrences(of: "&", with: "&amp;")
                          .replacingOccurrences(of: "<", with: "&lt;")
        web.loadHTMLString("""
        <html><head><meta name='viewport' content='width=device-width'><style>
        :root{color-scheme:light dark}
        body{margin:0;background:#fff;color:#17212f;font-family:-apple-system,system-ui;
        display:grid;place-items:center;height:100vh}main{max-width:620px;padding:35px;text-align:center}
        h1{font-size:28px;letter-spacing:-.6px}p{line-height:1.6;color:#526174;font-size:14px}
        @media(prefers-color-scheme:dark){body{background:#1b1c1f;color:#f0f2f5}p{color:#b2bac7}}
        </style></head><body><main><h1>Tenet</h1><p>\(safe)</p></main></body></html>
        """, baseURL: nil)
    }

    private func applyAppearance(_ preference: String) {
        window.appearance = preference == "system" ? nil : NSAppearance(named: preference == "dark" ? .darkAqua : .aqua)
        let dark = window.effectiveAppearance.bestMatch(from:[.darkAqua,.aqua]) == .darkAqua
        window.backgroundColor = NSColor(calibratedWhite:dark ? 0.106 : 1, alpha:1)
        web?.underPageBackgroundColor = window.backgroundColor
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Only the owning loopback main document can set this display preference.
        guard message.name == "tenetAppearance", message.frameInfo.isMainFrame,
              let origin = message.frameInfo.request.url, origin.scheme == "http",
              origin.host == "127.0.0.1", origin.port == 18766,
              let body = message.body as? [String:String], let preference = body["appearance"],
              ["light","dark","system"].contains(preference) else {return}
        UserDefaults.standard.set(preference, forKey:"TenetAppearance")
        applyAppearance(preference)
    }

    private func startRuntime() {
        guard let resourceURL = Bundle.main.resourceURL else { launchFailure = "Missing application resources"; return }
        let pathURL = resourceURL.appendingPathComponent("opentutor-path.txt")
        guard let contents = try? String(contentsOf:pathURL, encoding:.utf8) else {
            launchFailure = "OpenTutor installation location is missing"; return
        }
        let root = URL(fileURLWithPath:contents.trimmingCharacters(in:.whitespacesAndNewlines), isDirectory:true)
        let script = resourceURL.appendingPathComponent("mastery_launch.sh")
        guard FileManager.default.fileExists(atPath:script.path) else {
            launchFailure = "Mastery runtime missing. Re-run the installer"; return
        }
        let logDir = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/MasteryEngine2",isDirectory:true)
        try? FileManager.default.createDirectory(at:logDir,withIntermediateDirectories:true)
        let logFile = logDir.appendingPathComponent("launch.log")
        if !FileManager.default.fileExists(atPath:logFile.path) {
            FileManager.default.createFile(atPath:logFile.path,contents:nil)
        }
        let log = FileHandle(forWritingAtPath:logFile.path)
        try? log?.seekToEnd()
        let task = Process()
        task.executableURL = URL(fileURLWithPath:"/bin/bash")
        task.arguments = [script.path, root.path, resourceURL.path]
        task.currentDirectoryURL = root
        var env = ProcessInfo.processInfo.environment
        let home = NSHomeDirectory()
        let installRoot = root.deletingLastPathComponent().path
        env["DEEPTUTOR_HOME"] = "\(installRoot)/deeptutor-data"
        let oldPath = env["PATH"] ?? "/usr/bin:/bin"
        env["PATH"] = "\(installRoot)/deeptutor-venv/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\(oldPath)"
        env["MASTERY_DATA_DIR"] = env["MASTERY_DATA_DIR"] ?? "\(home)/Library/Application Support/MasteryEngine2"
        env["MASTERY_INSTANCE_ID"] = runtimeInstanceID
        expectedDataFile = URL(fileURLWithPath:env["MASTERY_DATA_DIR"]!,isDirectory:true)
            .appendingPathComponent("mastery.sqlite3").resolvingSymlinksInPath().path
        task.environment = env
        task.standardOutput = log
        task.standardError = log
        do {try task.run();server = task}
        catch {launchFailure = "Could not start OpenTutor. Check ~/Library/Logs/MasteryEngine2/launch.log"}
    }

    private func checkServer() {
        if let failure = launchFailure {showWaiting(failure);return}
        if attempts > 120 {
            showWaiting("The local servers did not start. Check ~/Library/Logs/MasteryEngine2/launch.log and re-run the installer if necessary.")
            return
        }
        attempts += 1
        if let p = server, !p.isRunning {
            launchFailure = "The local runtime exited. Check ~/Library/Logs/MasteryEngine2/launch.log"
            showWaiting(launchFailure!)
            return
        }
        guard let url=URL(string:"http://127.0.0.1:18766/api/mastery/health") else {return}
        var request=URLRequest(url:url)
        request.timeoutInterval=2
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let healthy: Bool = {
                guard let r=response as? HTTPURLResponse, r.statusCode == 200,
                      let data=data,
                      let json=try? JSONSerialization.jsonObject(with:data) as? [String:Any],
                      (json["status"] as? String) == "ok",
                      (json["instance_id"] as? String) == self.runtimeInstanceID,
                      let file=json["data_file"] as? String,
                      URL(fileURLWithPath:file).resolvingSymlinksInPath().path == self.expectedDataFile else {return false}
                return true
            }()
            DispatchQueue.main.async {
                if healthy, self.server?.isRunning == true {
                    self.web.load(URLRequest(url:URL(string:"http://127.0.0.1:18766/mastery")!))
                } else {
                    DispatchQueue.main.asyncAfter(deadline:.now()+1) {self.checkServer()}
                }
            }
        }.resume()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        // Loading the ready workspace can cancel the startup document normally.
        let failure = error as NSError
        if failure.domain == NSURLErrorDomain && failure.code == NSURLErrorCancelled { return }
        showWaiting("Connection to local OpenTutor was interrupted. Restart the app if needed.")
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {true}

    func applicationWillTerminate(_ notification: Notification) {
        if let p=server, p.isRunning {p.terminate()}
    }
}
