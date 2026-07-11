import AppKit
@preconcurrency import AVFoundation
import AVFAudio
import Foundation
import WebKit

func isPrometheusEscapeEvent(_ event: NSEvent) -> Bool {
    event.type == .keyDown &&
        (event.keyCode == 53 ||
            event.characters == "\u{1b}" ||
            event.charactersIgnoringModifiers == "\u{1b}")
}

@objc(PrometheusCompanionApplication)
final class PrometheusCompanionApplication: NSApplication {
    var onEscape: (() -> Void)?

    override func sendEvent(_ event: NSEvent) {
        if isPrometheusEscapeEvent(event) {
            onEscape?()
            return
        }
        super.sendEvent(event)
    }
}

final class PrometheusCompanionWindow: NSWindow {
    var onEscape: (() -> Void)?

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func keyDown(with event: NSEvent) {
        if isPrometheusEscapeEvent(event) {
            onEscape?()
            return
        }
        super.keyDown(with: event)
    }

    override func cancelOperation(_ sender: Any?) {
        onEscape?()
    }
}

@MainActor
final class PrometheusCompanion: NSObject, NSApplicationDelegate, AVAudioPlayerDelegate, AVSpeechSynthesizerDelegate, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let founderGreeting = "I'm here. What are we working on?"
    private let osURL = URL(string: ProcessInfo.processInfo.environment["PROMETHEUS_OS_URL"] ?? "http://127.0.0.1:8791/prometheus-os/")!
    private let ttsEndpoint = URL(string: ProcessInfo.processInfo.environment["PROMETHEUS_TTS_ENDPOINT"] ?? "http://127.0.0.1:8792/api/tts")!
    private let sttEndpoint = URL(string: ProcessInfo.processInfo.environment["PROMETHEUS_STT_ENDPOINT"] ?? "http://127.0.0.1:8792/api/stt")!
    private let assistantEndpoint = URL(string: ProcessInfo.processInfo.environment["PROMETHEUS_ASSISTANT_ENDPOINT"] ?? "http://127.0.0.1:8792/api/assistant")!
    private let ttsProvider = ProcessInfo.processInfo.environment["PROMETHEUS_TTS_PROVIDER"] ?? "elevenlabs"
    private let ttsPreferredVoice = ProcessInfo.processInfo.environment["PROMETHEUS_TTS_VOICE"] ?? ""
    private let nativeSttFallbackEnabled = ProcessInfo.processInfo.environment["PROMETHEUS_NATIVE_STT_FALLBACK"] == "1"
    private let wakePhrases = ["prometheus", "good morning prometheus", "hey prometheus"]
    private let appSupportURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/PrometheusCompanion")
    private let logFileURL = FileManager.default.homeDirectoryForCurrentUser
        .appendingPathComponent("Library/Application Support/PrometheusCompanion/logs/companion.log")

    private let speechSynthesizer = AVSpeechSynthesizer()
    private let audioEngine = AVAudioEngine()
    private var premiumAudioPlayer: AVAudioPlayer?
    private var prometheusWindow: NSWindow?
    private var prometheusWebView: WKWebView?
    private var statusItem: NSStatusItem?
    private var escapeEventMonitor: Any?
    private var globalEscapeEventMonitor: Any?
    private var isLoadingPrometheusOS = false
    private var didLoadPrometheusOS = false
    private var webLoadGeneration = 0
    private var lastWakeAt = Date.distantPast
    private var lastClapAt = Date.distantPast
    private var lastGreetingAt = Date.distantPast
    private var lastTranscript = ""
    private var lastDirectCommandAt = Date.distantPast
    private var lastDirectCommandNodeId = ""
    private var isSpeaking = false
    private var didStart = false
    private var shouldResumeListeningAfterSpeech = false
    private var conversationActive = false
    private var conversationHistory: [ChatMessage] = []
    private var nativeSttLoopEnabled = false
    private var nativeSttCaptureBusy = false
    private var nativeSttTimer: Timer?
    private var nativeSttWorkItem: DispatchWorkItem?
    private var nativeAudioSamples: [Float] = []
    private var nativeAudioSampleRate: Double = 44_100
    private var nativePauseUntil = Date.distantPast
    private var lastNativeTranscript = ""
    private var lastNativeTranscriptAt = Date.distantPast
    private var nativeAudioRecorder: AVAudioRecorder?
    private var nativeRecordingURL: URL?
    private var audioPlaybackGeneration = 0
    private var speechRequestGeneration = 0
    private var assistantTask: URLSessionDataTask?
    private var premiumTtsTask: URLSessionDataTask?
    private var backgroundProcesses: [String: Process] = [:]
    private var backgroundLogHandles: [String: FileHandle] = [:]

    private struct ChatMessage: Codable {
        let role: String
        let content: String
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        startCompanionIfNeeded()
    }

    func startCompanionIfNeeded() {
        guard !didStart else { return }
        didStart = true
        configureApplicationEscapeHandler()
        configureAppIcon()
        NSApp.setActivationPolicy(.regular)
        speechSynthesizer.delegate = self
        startLocalServicesIfNeeded()
        configureMenuBar()
        configureWakeObservers()
        installEscapeMonitorIfNeeded()
        showPrometheusWindow()
        greetAfterLoginOrUnlock()
        requestPermissionsAndStart()
    }

    private func configureAppIcon() {
        if let iconURL = Bundle.main.url(forResource: "PrometheusCompanion", withExtension: "icns"),
           let icon = NSImage(contentsOf: iconURL) {
            NSApp.applicationIconImage = icon
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let escapeEventMonitor {
            NSEvent.removeMonitor(escapeEventMonitor)
            self.escapeEventMonitor = nil
        }
        if let globalEscapeEventMonitor {
            NSEvent.removeMonitor(globalEscapeEventMonitor)
            self.globalEscapeEventMonitor = nil
        }
        NSApp.presentationOptions = []
        stopListening()
    }

    private func configureMenuBar() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.title = "🔥 Prometheus"

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Open Prometheus OS Full Screen", action: #selector(openPrometheusOSAction), keyEquivalent: "o"))
        menu.addItem(NSMenuItem(title: "Test Greeting", action: #selector(testGreeting), keyEquivalent: "g"))
        menu.addItem(NSMenuItem(title: "Daily Founder Brief", action: #selector(dailyFounderBriefAction), keyEquivalent: "b"))
        menu.addItem(NSMenuItem(title: "Test Assistant Conversation", action: #selector(testAssistantConversation), keyEquivalent: "a"))
        menu.addItem(NSMenuItem(title: "Enable Microphone", action: #selector(enableMicrophoneAction), keyEquivalent: "m"))
        menu.addItem(NSMenuItem(title: "Restart Listening", action: #selector(restartListeningAction), keyEquivalent: "r"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Prometheus", action: #selector(quit), keyEquivalent: "q"))
        item.menu = menu
        statusItem = item
    }

    private func startLocalServicesIfNeeded() {
        do {
            try FileManager.default.createDirectory(
                at: appSupportURL.appendingPathComponent("logs"),
                withIntermediateDirectories: true
            )
        } catch {
            log("Could not create Companion log directory: \(error.localizedDescription).")
        }

        if !isPortListening(8791) {
            launchBackgroundProcess(
                executable: "/usr/bin/python3",
                arguments: ["-m", "http.server", "8791", "--bind", "127.0.0.1"],
                workingDirectory: appSupportURL,
                logName: "static-server"
            )
        } else {
            log("Prometheus OS static server already listening on 8791.")
        }

        if !isPortListening(8792) {
            guard let node = nodeExecutable() else {
                log("Node was not found. Premium TTS/STT backend cannot start.")
                return
            }

            launchBackgroundProcess(
                executable: node,
                arguments: ["prometheus-os/backend/server.js"],
                workingDirectory: appSupportURL,
                logName: "tts-backend"
            )
        } else {
            log("Prometheus OS backend already listening on 8792.")
        }
    }

    private func isPortListening(_ port: Int) -> Bool {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/lsof")
        process.arguments = ["-nP", "-iTCP:\(port)", "-sTCP:LISTEN"]
        process.standardOutput = Pipe()
        process.standardError = Pipe()

        do {
            try process.run()
            process.waitUntilExit()
            return process.terminationStatus == 0
        } catch {
            log("Port check failed for \(port): \(error.localizedDescription).")
            return false
        }
    }

    private func nodeExecutable() -> String? {
        ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"].first {
            FileManager.default.isExecutableFile(atPath: $0)
        }
    }

    private func launchBackgroundProcess(
        executable: String,
        arguments: [String],
        workingDirectory: URL,
        logName: String
    ) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        process.currentDirectoryURL = workingDirectory

        let logURL = appSupportURL
            .appendingPathComponent("logs")
            .appendingPathComponent("\(logName).log")
        FileManager.default.createFile(atPath: logURL.path, contents: nil)

        do {
            let handle = try FileHandle(forWritingTo: logURL)
            try handle.seekToEnd()
            process.standardOutput = handle
            process.standardError = handle
            try process.run()
            backgroundProcesses[logName] = process
            backgroundLogHandles[logName] = handle
            process.terminationHandler = { [weak self] finishedProcess in
                Task { @MainActor [weak self] in
                    self?.log("Background service \(logName) exited with status \(finishedProcess.terminationStatus).")
                    self?.backgroundProcesses[logName] = nil
                    self?.backgroundLogHandles[logName] = nil
                }
            }
            log("Started \(logName) service with PID \(process.processIdentifier).")
        } catch {
            log("Failed to start \(logName) service: \(error.localizedDescription).")
        }
    }

    private func configureWakeObservers() {
        let center = NSWorkspace.shared.notificationCenter
        center.addObserver(self, selector: #selector(macDidWake), name: NSWorkspace.didWakeNotification, object: nil)
        center.addObserver(self, selector: #selector(sessionDidBecomeActive), name: NSWorkspace.sessionDidBecomeActiveNotification, object: nil)
        center.addObserver(self, selector: #selector(screensDidWake), name: NSWorkspace.screensDidWakeNotification, object: nil)
    }

    @objc private func macDidWake() {
        greetAfterLoginOrUnlock()
    }

    @objc private func sessionDidBecomeActive() {
        greetAfterLoginOrUnlock()
    }

    @objc private func screensDidWake() {
        greetAfterLoginOrUnlock()
    }

    @objc private func openPrometheusOSAction() {
        showPrometheusWindow()
    }

    @objc private func testGreeting() {
        speak(founderGreeting)
    }

    @objc private func testAssistantConversation() {
        conversationActive = true
        askAssistant("What should I work on next for Route IQ?")
    }

    @objc private func dailyFounderBriefAction() {
        conversationActive = true
        askAssistant("Prometheus, give me today's brief.")
    }

    @objc private func restartListeningAction() {
        startListening()
    }

    @objc private func enableMicrophoneAction() {
        AVCaptureDevice.requestAccess(for: .audio) { [weak self] granted in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if granted {
                    self.log("Microphone authorization granted from explicit Founder action.")
                    self.startListening()
                    return
                }
                self.log("Microphone authorization denied from explicit Founder action.")
                self.prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Microphone blocked', 'permission was not granted', 'warn')")
            }
        }
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    private func showPrometheusWindow() {
        let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let webView: WKWebView

        if let existingWebView = prometheusWebView {
            webView = existingWebView
        } else {
            let configuration = WKWebViewConfiguration()
            configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
            configuration.websiteDataStore = .nonPersistent()
            let nativeCaptureScript = WKUserScript(
                source: "window.__PROMETHEUS_COMPANION_SHELL__ = true;",
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
            configuration.userContentController.addUserScript(nativeCaptureScript)
            configuration.userContentController.add(self, name: "prometheusLog")
            configuration.userContentController.add(self, name: "prometheusEscape")
            webView = WKWebView(frame: screenFrame, configuration: configuration)
            webView.wantsLayer = true
            webView.layer?.backgroundColor = NSColor.black.cgColor
            webView.setValue(false, forKey: "drawsBackground")
            webView.navigationDelegate = self
            webView.uiDelegate = self
            webView.loadHTMLString(Self.loadingHTML, baseURL: nil)
            prometheusWebView = webView
        }

        if prometheusWindow == nil {
            let window = PrometheusCompanionWindow(
                contentRect: screenFrame,
                styleMask: [.borderless],
                backing: .buffered,
                defer: false
            )
            window.onEscape = { [weak self] in
                Task { @MainActor [weak self] in
                    self?.handleEscapeExit(source: "native window escape")
                }
            }
            window.title = "Prometheus OS"
            window.level = .mainMenu
            window.backgroundColor = .black
            window.isOpaque = true
            window.hasShadow = false
            window.hidesOnDeactivate = false
            window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
            window.contentView = webView
            prometheusWindow = window
        }

        guard let window = prometheusWindow else { return }
        window.setFrame(screenFrame, display: true)
        if let companionWindow = window as? PrometheusCompanionWindow {
            companionWindow.onEscape = { [weak self] in
                Task { @MainActor [weak self] in
                    self?.handleEscapeExit(source: "native window escape")
                }
            }
        }
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        window.makeFirstResponder(webView)
        NSApp.presentationOptions = [.autoHideMenuBar, .autoHideDock]
        NSApp.activate(ignoringOtherApps: true)
        NSRunningApplication.current.activate(options: [.activateAllWindows])

        loadPrometheusOSWhenReady()
        log("Prometheus OS window opened and focused.")
    }

    private func loadPrometheusOSWhenReady(attempt: Int = 0) {
        guard !didLoadPrometheusOS else { return }
        guard !isLoadingPrometheusOS || attempt > 0 else { return }

        isLoadingPrometheusOS = true

        var readinessRequest = URLRequest(url: osURL)
        readinessRequest.httpMethod = "HEAD"
        readinessRequest.cachePolicy = .reloadIgnoringLocalCacheData
        readinessRequest.timeoutInterval = 2

        URLSession.shared.dataTask(with: readinessRequest) { [weak self] _, response, error in
            Task { @MainActor [weak self] in
                guard let self else { return }

                let statusCode = (response as? HTTPURLResponse)?.statusCode ?? 0
                let isReady = error == nil && (200..<400).contains(statusCode)

                if isReady {
                    self.startPrometheusWebLoad()
                    return
                }

                if attempt >= 30 {
                    self.isLoadingPrometheusOS = false
                    self.log("Prometheus OS page was not ready after startup retries. Last status: \(statusCode).")
                    return
                }

                self.log("Prometheus OS page not ready yet. Retry \(attempt + 1).")
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) { [weak self] in
                    self?.loadPrometheusOSWhenReady(attempt: attempt + 1)
                }
            }
        }.resume()
    }

    private func startPrometheusWebLoad() {
        guard let webView = prometheusWebView else {
            isLoadingPrometheusOS = false
            return
        }

        webLoadGeneration += 1
        let currentGeneration = webLoadGeneration
        didLoadPrometheusOS = false
        isLoadingPrometheusOS = true

        webView.stopLoading()
        webView.load(URLRequest(
            url: cacheBustedOSURL(),
            cachePolicy: .reloadIgnoringLocalCacheData,
            timeoutInterval: 15
        ))
        log("Prometheus OS page ready. WebView navigation started.")

        DispatchQueue.main.asyncAfter(deadline: .now() + 6) { [weak self] in
            guard let self else { return }
            guard self.webLoadGeneration == currentGeneration else { return }
            guard !self.didLoadPrometheusOS else { return }

            self.log("Prometheus OS WebView did not finish loading. Forcing retry.")
            self.prometheusWebView?.stopLoading()
            self.prometheusWebView?.loadHTMLString(Self.loadingHTML, baseURL: nil)
            self.isLoadingPrometheusOS = false
            self.loadPrometheusOSWhenReady()
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        didLoadPrometheusOS = true
        isLoadingPrometheusOS = false
        log("Prometheus OS WebView finished loading.")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        didLoadPrometheusOS = false
        isLoadingPrometheusOS = false
        log("Prometheus OS WebView load failed: \(error.localizedDescription). Retrying.")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.loadPrometheusOSWhenReady()
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        didLoadPrometheusOS = false
        isLoadingPrometheusOS = false
        log("Prometheus OS WebView provisional load failed: \(error.localizedDescription). Retrying.")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.loadPrometheusOSWhenReady()
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        didLoadPrometheusOS = false
        isLoadingPrometheusOS = false
        log("Prometheus OS WebView process terminated. Reloading.")
        webView.loadHTMLString(Self.loadingHTML, baseURL: nil)
        loadPrometheusOSWhenReady()
    }

    private func cacheBustedOSURL() -> URL {
        guard var components = URLComponents(url: osURL, resolvingAgainstBaseURL: false) else {
            return osURL
        }

        var queryItems = components.queryItems ?? []
        queryItems.removeAll { $0.name == "companionBuild" }
        queryItems.append(URLQueryItem(name: "companionBuild", value: String(Int(Date().timeIntervalSince1970))))
        components.queryItems = queryItems
        return components.url ?? osURL
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "prometheusEscape" {
            handleEscapeExit(source: "web escape")
            return
        }

        guard message.name == "prometheusLog" else { return }

        if let payload = message.body as? [String: Any] {
            let stage = String(describing: payload["stage"] ?? "WebView voice")
            let detail = String(describing: payload["message"] ?? "")
            let kind = String(describing: payload["kind"] ?? "info")
            log("WebView voice \(kind): \(stage)\(detail.isEmpty ? "" : ": \(detail)")")
            return
        }

        log("WebView voice info: \(String(describing: message.body))")
    }

    private func configureApplicationEscapeHandler() {
        if let app = NSApp as? PrometheusCompanionApplication {
            app.onEscape = { [weak self] in
                Task { @MainActor [weak self] in
                    self?.handleEscapeExit(source: "native app escape")
                }
            }
        }
    }

    private func installEscapeMonitorIfNeeded() {
        guard escapeEventMonitor == nil else { return }

        escapeEventMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            if isPrometheusEscapeEvent(event) {
                Task { @MainActor [weak self] in
                    self?.handleEscapeExit(source: "native local escape monitor")
                }
                return nil
            }
            return event
        }

        globalEscapeEventMonitor = NSEvent.addGlobalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard isPrometheusEscapeEvent(event) else { return }
            Task { @MainActor [weak self] in
                guard self?.prometheusWindow?.isVisible == true else { return }
                self?.handleEscapeExit(source: "native global escape monitor")
            }
        }
    }

    private func handleEscapeExit(source: String = "escape") {
        log("ESC exit requested: \(source).")
        conversationActive = false
        shouldResumeListeningAfterSpeech = false
        nativePauseUntil = Date.distantFuture
        stopSpeaking(source: source, resumeListening: false)
        stopListening()
        prometheusWebView?.evaluateJavaScript("window.prometheusOSHandleNativeEscape && window.prometheusOSHandleNativeEscape(\(Self.javascriptStringLiteral(source)))")
        prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Exited', 'immersive Companion stopped', 'ok')")
        prometheusWindow?.orderOut(nil)
        NSApp.presentationOptions = []
        NSApp.hide(nil)
        log("ESC exit completed.")
    }

    @available(macOS 12.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        let host = origin.host.lowercased()
        let isLocalPrometheus = host == "127.0.0.1" || host == "localhost"
        let isMicrophoneRequest = type == .microphone || type == .cameraAndMicrophone

        if isLocalPrometheus && isMicrophoneRequest {
            log("Automatically granted local Prometheus OS microphone capture request for \(host).")
            decisionHandler(.grant)
            return
        }

        log("Denied non-local or non-microphone media capture request from \(host).")
        decisionHandler(.deny)
    }

    private func greetAfterLoginOrUnlock() {
        guard Date().timeIntervalSince(lastGreetingAt) > 45 else { return }
        lastGreetingAt = Date()
        if prometheusWindow == nil || prometheusWindow?.isVisible == false {
            showPrometheusWindow()
        }
        speak(founderGreeting)
    }

    private func requestPermissionsAndStart() {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        if status == .authorized {
            log("Microphone authorization already granted. Starting Companion WebView STT.")
            startListening()
            return
        }

        log("Microphone authorization is \(microphoneAuthorizationLabel(status)); Companion will not open the permission prompt on launch. Use Restart Listening after permission is granted.")
        prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Ready', 'microphone permission required before live listening', 'warn')")
    }

    private func startListening() {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        guard status == .authorized else {
            log("Listening not started because microphone authorization is \(microphoneAuthorizationLabel(status)).")
            prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Ready', 'microphone permission required before live listening', 'warn')")
            return
        }

        if isSpeaking {
            shouldResumeListeningAfterSpeech = true
            log("Listening start deferred while Prometheus is speaking.")
            return
        }

        guard !nativeSttLoopEnabled else {
            log("Prometheus Companion WebView STT loop already running.")
            return
        }

        nativeSttLoopEnabled = true
        nativePauseUntil = Date.distantPast
        log("Prometheus Companion WebView microphone capture enabled. Audio will be sent to local backend STT.")
        prometheusWebView?.evaluateJavaScript("window.prometheusOSStartListening && window.prometheusOSStartListening({ companionShell: true })")
    }

    private func stopListening() {
        log("Stopping speech recognition listener.")
        nativeSttLoopEnabled = false
        nativeSttTimer?.invalidate()
        nativeSttTimer = nil
        nativeSttWorkItem?.cancel()
        nativeSttWorkItem = nil
        nativeAudioRecorder?.stop()
        nativeAudioRecorder = nil
        nativeRecordingURL = nil
        nativeSttCaptureBusy = false

        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
            log("Audio engine stopped and microphone tap removed.")
        } else {
            log("Audio engine was not running; skipped microphone tap cleanup.")
        }
    }

    private func scheduleNativeSttCapture(after delay: TimeInterval = 0.9) {
        guard nativeSttFallbackEnabled else {
            log("Legacy native STT fallback ignored. WebView MediaRecorder plus local backend STT is the active capture path.")
            return
        }
        nativeSttTimer?.invalidate()
        nativeSttTimer = nil
        nativeSttWorkItem?.cancel()
        guard nativeSttLoopEnabled else { return }

        log("Native STT capture scheduled in \(String(format: "%.1f", delay)) seconds.")
        let workItem = DispatchWorkItem { [weak self] in
            self?.captureNativeCommandAudio()
        }
        nativeSttWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + delay, execute: workItem)
    }

    private func captureNativeCommandAudio(duration: TimeInterval = 4.2) {
        guard nativeSttFallbackEnabled else {
            log("Legacy native STT capture blocked. Set PROMETHEUS_NATIVE_STT_FALLBACK=1 only for deliberate diagnostics.")
            return
        }
        log("Native STT capture tick entered.")
        guard nativeSttLoopEnabled else { return }

        if isSpeaking || Date() < nativePauseUntil {
            log("Native STT capture postponed because Prometheus is speaking or paused.")
            scheduleNativeSttCapture(after: 1.0)
            return
        }

        guard !nativeSttCaptureBusy else { return }
        log("Native STT capture preparing audio recorder. Recording authorization: \(audioRecordPermissionLabel()).")

        guard isAudioRecordPermissionGranted() else {
            let permissionLabel = audioRecordPermissionLabel()
            log("Native STT capture blocked until microphone recording is authorized: \(permissionLabel).")
            prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Mic permission issue', \(Self.javascriptStringLiteral("Microphone recording authorization is \(permissionLabel).")), 'error')")
            nativeSttLoopEnabled = false
            requestPermissionsAndStart()
            return
        }

        nativeSttWorkItem = nil
        nativeSttCaptureBusy = true

        do {
            log("Native STT capture creating temporary recording URL.")
            let fileName = "prometheus-native-stt-\(UUID().uuidString).m4a"
            let recordingURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent(fileName)
            log("Native STT capture recording URL ready.")

            let settings: [String: Any] = [
                AVFormatIDKey: kAudioFormatMPEG4AAC,
                AVSampleRateKey: 44_100,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue
            ]
            log("Native STT capture settings ready.")

            log("Native STT capture creating AVAudioRecorder.")
            let recorder = try AVAudioRecorder(url: recordingURL, settings: settings)
            log("Native STT capture recorder created.")

            log("Native STT capture preparing recorder.")
            let prepared = recorder.prepareToRecord()
            log("Native STT capture prepareToRecord result: \(prepared).")

            log("Native STT capture starting recorder.")
            guard recorder.record() else {
                nativeSttCaptureBusy = false
                log("Native STT capture failed: AVAudioRecorder did not start.")
                scheduleNativeSttCapture(after: 2.0)
                return
            }

            nativeAudioRecorder = recorder
            nativeRecordingURL = recordingURL
            log("Native STT capture started.")
            prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Listening', 'Native microphone capture started')")
        } catch {
            nativeSttCaptureBusy = false
            log("Native STT capture failed to start: \(error.localizedDescription).")
            scheduleNativeSttCapture(after: 2.0)
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + duration) { [weak self] in
            self?.finishNativeRecorderCapture()
        }
    }

    private func microphoneAuthorizationLabel(_ status: AVAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not determined"
        @unknown default:
            return "unknown"
        }
    }

    private func isAudioRecordPermissionGranted() -> Bool {
        if #available(macOS 14.0, *) {
            return AVAudioApplication.shared.recordPermission == .granted
        }

        return AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
    }

    private func audioRecordPermissionLabel() -> String {
        if #available(macOS 14.0, *) {
            switch AVAudioApplication.shared.recordPermission {
            case .granted:
                return "granted"
            case .denied:
                return "denied"
            case .undetermined:
                return "undetermined"
            @unknown default:
                return "unknown"
            }
        }

        return microphoneAuthorizationLabel(AVCaptureDevice.authorizationStatus(for: .audio))
    }

    private func finishNativeRecorderCapture() {
        guard nativeSttCaptureBusy else { return }

        nativeAudioRecorder?.stop()
        nativeAudioRecorder = nil

        guard let recordingURL = nativeRecordingURL else {
            nativeSttCaptureBusy = false
            log("Native STT capture failed: recording URL missing.")
            scheduleNativeSttCapture(after: 1.5)
            return
        }

        nativeRecordingURL = nil
        nativeSttCaptureBusy = false

        do {
            let audio = try Data(contentsOf: recordingURL)
            try? FileManager.default.removeItem(at: recordingURL)

            guard audio.count > 4_096 else {
                log("Native STT skipped: recorded audio was too small.")
                scheduleNativeSttCapture(after: 0.8)
                return
            }

            log("Native STT capture finished with \(audio.count) bytes.")
            transcribeNativeAudio(audio, contentType: "audio/mp4")
        } catch {
            log("Native STT capture read failed: \(error.localizedDescription).")
            scheduleNativeSttCapture(after: 1.5)
            return
        }
    }

    private func makeMonoWavData(samples: [Float], sampleRate: Int) -> Data {
        let channels: UInt16 = 1
        let bitsPerSample: UInt16 = 16
        let bytesPerSample = Int(bitsPerSample / 8)
        let byteRate = UInt32(sampleRate * Int(channels) * bytesPerSample)
        let blockAlign = UInt16(Int(channels) * bytesPerSample)
        let dataSize = UInt32(samples.count * bytesPerSample)

        var data = Data()

        func appendString(_ value: String) {
            data.append(value.data(using: .ascii) ?? Data())
        }

        func appendUInt16(_ value: UInt16) {
            var littleEndian = value.littleEndian
            withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
        }

        func appendUInt32(_ value: UInt32) {
            var littleEndian = value.littleEndian
            withUnsafeBytes(of: &littleEndian) { data.append(contentsOf: $0) }
        }

        appendString("RIFF")
        appendUInt32(36 + dataSize)
        appendString("WAVE")
        appendString("fmt ")
        appendUInt32(16)
        appendUInt16(1)
        appendUInt16(channels)
        appendUInt32(UInt32(sampleRate))
        appendUInt32(byteRate)
        appendUInt16(blockAlign)
        appendUInt16(bitsPerSample)
        appendString("data")
        appendUInt32(dataSize)

        for sample in samples {
            let clipped = max(-1.0, min(1.0, sample))
            var pcm = Int16(clipped * Float(Int16.max)).littleEndian
            withUnsafeBytes(of: &pcm) { data.append(contentsOf: $0) }
        }

        return data
    }

    private func transcribeNativeAudio(_ audio: Data, contentType: String = "audio/wav") {
        var request = URLRequest(url: sttEndpoint)
        request.httpMethod = "POST"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("auto", forHTTPHeaderField: "X-Prometheus-STT-Provider")
        request.timeoutInterval = 20
        request.httpBody = audio

        log("Native STT request started.")

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error {
                Task { @MainActor [weak self] in
                    self?.log("Native STT network error: \(error.localizedDescription).")
                    if let webView = self?.prometheusWebView {
                        _ = try? await webView.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Error', 'Native STT network error')")
                    }
                    self?.scheduleNativeSttCapture(after: 2.0)
                }
                return
            }

            guard let http = response as? HTTPURLResponse else {
                Task { @MainActor [weak self] in
                    self?.log("Native STT failed: missing HTTP response.")
                    self?.scheduleNativeSttCapture(after: 2.0)
                }
                return
            }

            guard let data, http.statusCode == 200 else {
                let reason = Self.safeProviderError(from: data)
                Task { @MainActor [weak self] in
                    self?.log("Native STT failed with status \(http.statusCode): \(reason)")
                    let debugMessage = "Native STT failed: \(reason)"
                    if let webView = self?.prometheusWebView {
                        _ = try? await webView.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Error', \(Self.javascriptStringLiteral(debugMessage)), 'error')")
                    }
                    self?.scheduleNativeSttCapture(after: 2.0)
                }
                return
            }

            do {
                let sttResponse = try JSONDecoder().decode(STTResponse.self, from: data)
                Task { @MainActor [weak self] in
                    self?.processNativeTranscript(sttResponse.text ?? "")
                }
            } catch {
                Task { @MainActor [weak self] in
                    self?.log("Native STT response decoding failed: \(error.localizedDescription).")
                    self?.scheduleNativeSttCapture(after: 1.5)
                }
            }
        }.resume()
    }

    private struct STTResponse: Codable {
        let text: String?
        let provider: String?
        let language: String?
    }

    private func processNativeTranscript(_ transcript: String) {
        let cleanTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTranscript.isEmpty else {
            scheduleNativeSttCapture(after: 0.8)
            return
        }

        let now = Date()
        if cleanTranscript.caseInsensitiveCompare(lastNativeTranscript) == .orderedSame &&
            now.timeIntervalSince(lastNativeTranscriptAt) < 6 {
            scheduleNativeSttCapture(after: 1.0)
            return
        }

        lastNativeTranscript = cleanTranscript
        lastNativeTranscriptAt = now
        log("Native STT transcript captured: \(cleanTranscript)")
        prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Heard', \(Self.javascriptStringLiteral(cleanTranscript)))")

        if isStopCommand(cleanTranscript) {
            stopSpeaking(source: "native STT")
            scheduleNativeSttCapture(after: 0.4)
            return
        }

        let hasGreeting = isFounderGreeting(cleanTranscript)
        let hasWakePhrase = extractWakeCommand(from: cleanTranscript) != nil
        let hasDirectCommand = directSystemCommand(for: cleanTranscript) != nil
        let hasFounderReasoningQuestion = isFounderReasoningQuestion(cleanTranscript)
        let hasFounderConversationPrompt = isFounderConversationPrompt(cleanTranscript)
        guard hasGreeting || hasWakePhrase || hasDirectCommand || hasFounderReasoningQuestion || hasFounderConversationPrompt || conversationActive else {
            scheduleNativeSttCapture(after: 0.8)
            return
        }

        if hasGreeting {
            conversationActive = true
            speak(greetingResponse(for: cleanTranscript))
            return
        }

        if let wakeCommand = extractWakeCommand(from: cleanTranscript),
           wakeCommand.isEmpty || wakeCommand == "good morning" {
            conversationActive = true
            speak(founderGreeting)
            return
        }

        routeTranscriptThroughWeb(cleanTranscript)
    }

    private func routeTranscriptThroughWeb(_ transcript: String) {
        conversationActive = true
        nativePauseUntil = Date().addingTimeInterval(8)

        if isFounderReasoningQuestion(transcript) {
            let suppressScript = "window.prometheusOSSuppressCardsForIntelligence && window.prometheusOSSuppressCardsForIntelligence('native intelligence route selected')"
            prometheusWebView?.evaluateJavaScript(suppressScript)
        }

        let script = "window.prometheusOSSubmitCommand && window.prometheusOSSubmitCommand(\(Self.javascriptStringLiteral(transcript)))"
        prometheusWebView?.evaluateJavaScript(script) { [weak self] result, error in
            Task { @MainActor [weak self] in
                guard let self else { return }
                if let error {
                    self.log("Web command route failed: \(error.localizedDescription). Falling back to native route.")
                    self.answerWithNativeFounderFallback(transcript, reason: "web command route error")
                    return
                }
                if result == nil || result is NSNull {
                    self.log("Web command route returned no result. Using native founder fallback.")
                    self.answerWithNativeFounderFallback(transcript, reason: "web command route unavailable")
                    return
                }
                self.log("Transcript routed to Prometheus OS command router.")
                self.scheduleNativeSttCapture(after: 8.0)
            }
        }
    }

    private static func javascriptStringLiteral(_ value: String) -> String {
        guard
            let data = try? JSONEncoder().encode(value),
            let literal = String(data: data, encoding: .utf8)
        else {
            return "\"\""
        }
        return literal
    }

    private func handleTranscript(_ transcript: String, isFinal: Bool) {
        if isStopCommand(transcript) {
            stopSpeaking(source: "native transcript")
            return
        }

        guard !isSpeaking else { return }

        let cleanTranscript = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanTranscript.isEmpty else { return }

        if handleDirectSystemCommand(cleanTranscript) {
            conversationActive = true
            lastTranscript = cleanTranscript
            return
        }

        guard isFinal else { return }
        guard transcript != lastTranscript else { return }
        lastTranscript = transcript

        if let wakeCommand = extractWakeCommand(from: cleanTranscript) {
            guard Date().timeIntervalSince(lastWakeAt) > 2 else { return }
            lastWakeAt = Date()
            conversationActive = true

            if wakeCommand.isEmpty || wakeCommand == "good morning" {
                let reply = founderGreeting
                conversationHistory.append(ChatMessage(role: "user", content: cleanTranscript))
                conversationHistory.append(ChatMessage(role: "assistant", content: reply))
                trimConversationHistory()
                log("Wake phrase detected. Greeting response generated.")
                speak(reply)
                return
            }

            if handleDirectSystemCommand(wakeCommand) {
                return
            }

            askAssistant(wakeCommand)
            return
        }

        guard conversationActive else { return }
        askAssistant(cleanTranscript)
    }

    private func normalizeCommand(_ value: String) -> String {
        var normalized = value.lowercased()
        let removable = [
            "prometheus", "show me", "show", "open", "review", "status",
            "about", "what is", "what's", "tell me", "please"
        ]

        for word in removable {
            normalized = normalized.replacingOccurrences(of: word, with: " ")
        }

        normalized = normalized.replacingOccurrences(
            of: #"[^a-z0-9]+"#,
            with: " ",
            options: .regularExpression
        )
        normalized = normalized.replacingOccurrences(
            of: #"\s+"#,
            with: " ",
            options: .regularExpression
        )
        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func isFounderReasoningQuestion(_ transcript: String) -> Bool {
        let normalized = normalizeCommand(transcript)
        guard !normalized.isEmpty else { return false }

        let reasoningSignals = [
            "what happened yesterday",
            "happened yesterday",
            "what happened this week",
            "changed this week",
            "what changed today",
            "changed today",
            "what did we finish",
            "what should i do next",
            "what should i work on today",
            "advice",
            "what major systems have been built",
            "major systems have been built",
            "what changed in prometheus over the last month",
            "changed in prometheus over the last month",
            "over the last month",
            "route iq status",
            "gaia status",
            "athena status",
            "what is the current company phase",
            "what is the patent status",
            "what is the founder workflow",
            "what is the biggest risk to prometheus today",
            "what s slowing prometheus down",
            "what is slowing prometheus down",
            "slowing prometheus down",
            "bottleneck",
            "how are we doing",
            "if you were my coo",
            "what would you tell me to do tomorrow",
            "what is blocking deployment",
            "what is blocking customer onboarding",
            "enterprise hardening",
            "highest roi",
            "biggest risk",
            "biggest blocker",
            "current products",
            "company mission"
        ]

        return reasoningSignals.contains { signal in
            let normalizedSignal = normalizeCommand(signal)
            return normalized == normalizedSignal || normalized.contains(normalizedSignal)
        }
    }

    private func isFounderGreeting(_ transcript: String) -> Bool {
        let normalized = normalizeCommand(transcript)
        return ["hello", "hi", "hey", "good morning", "morning", "how are you", "how are you doing"].contains(normalized)
    }

    private func isStopCommand(_ transcript: String) -> Bool {
        let normalized = normalizeCommand(transcript)
        return ["stop", "stop talking", "quiet", "pause"].contains(normalized)
    }

    private func greetingResponse(for transcript: String) -> String {
        let normalized = normalizeCommand(transcript)
        if normalized == "how are you" || normalized == "how are you doing" {
            return "I'm online. What would you like to tackle?"
        }
        if normalized == "good morning" || normalized == "morning" {
            return "Good morning. What are we working on?"
        }
        return founderGreeting
    }

    private func isFounderConversationPrompt(_ transcript: String) -> Bool {
        let normalized = normalizeCommand(transcript)
        guard !normalized.isEmpty else { return false }
        let prompts = [
            "overwatch",
            "instagram",
            "social",
            "social media",
            "route iq",
            "gaia",
            "athena",
            "patent",
            "company phase",
            "founder workflow",
            "website",
            "site",
            "crm",
            "pipeline",
            "advice",
            "what should i work on today",
            "what s slowing prometheus down",
            "what is slowing prometheus down",
            "slowing prometheus down"
        ]
        return prompts.contains { prompt in
            let normalizedPrompt = normalizeCommand(prompt)
            return normalized == normalizedPrompt || normalized.contains(normalizedPrompt)
        }
    }

    private func normalizeFounderText(_ value: String) -> String {
        var normalized = value.lowercased()
        normalized = normalized.replacingOccurrences(of: "[’‘']", with: "", options: .regularExpression)
        normalized = normalized.replacingOccurrences(of: #"[^a-z0-9]+"#, with: " ", options: .regularExpression)
        normalized = normalized.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        return normalized.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func nativeFounderReply(for transcript: String) -> String? {
        let normalized = normalizeFounderText(transcript)
        guard !normalized.isEmpty else { return nil }

        if ["hello", "hi", "hey"].contains(normalized) {
            return founderGreeting
        }

        if normalized == "good morning" || normalized == "morning" || normalized == "good morning companion" {
            return "Good morning. Everything is ready whenever you are."
        }

        if normalized.contains("how are we doing") || normalized.contains("how are we looking") || normalized.contains("where do we stand") {
            return "Prometheus is in its operating phase. Route I Q is operational, Patent Pending, and the primary product. Gaia is paused, and Athena remains architecture only. The company is focused on deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement."
        }

        if normalized.contains("slowing prometheus down") || normalized.contains("whats slowing") || normalized.contains("what is slowing") || normalized.contains("bottleneck") {
            return "The constraint is operational readiness. The likely bottlenecks are authenticated production verification, account-owner security actions, repeatable customer onboarding, CRM handoff continuity, and turning real Route I Q activity into continuous improvement."
        }

        if normalized.contains("what should i work on first") || normalized.contains("what should i work on") || normalized.contains("what should i do next") || normalized.contains("what should i do") {
            return "Start in the Founder Workspace Switcher, set today's mission and mission queue, review the Research dossier, then pull the Route I Q prospect queue. Call the highest-value prospects first and update CRM stage after every call."
        }

        return nil
    }

    private func answerWithNativeFounderFallback(_ transcript: String, reason: String) {
        if let reply = nativeFounderReply(for: transcript) {
            log("Native founder fallback answered because \(reason).")
            conversationActive = true
            conversationHistory.append(ChatMessage(role: "user", content: transcript))
            conversationHistory.append(ChatMessage(role: "assistant", content: reply))
            trimConversationHistory()
            speak(reply)
            return
        }

        handleTranscript(transcript, isFinal: true)
    }

    private func isExplicitNodeRequest(_ transcript: String) -> Bool {
        let normalized = transcript.lowercased()
            .replacingOccurrences(of: "[^a-z0-9 ]+", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalized.isEmpty else { return false }

        let explicitSignals = [
            "open",
            "display",
            "pull up",
            "bring up",
            "configure",
            "show card",
            "show node",
            "show dashboard",
            "show settings",
            "view card",
            "view node",
            "view dashboard",
            "view settings"
        ]

        return explicitSignals.contains { normalized.contains($0) }
    }

    private func directSystemCommand(for transcript: String) -> (nodeId: String, response: String)? {
        guard !isFounderReasoningQuestion(transcript) else { return nil }
        guard isExplicitNodeRequest(transcript) else { return nil }
        let normalized = normalizeCommand(transcript)
        guard !normalized.isEmpty else { return nil }

        let commands: [(nodeId: String, phrases: [String], response: String)] = [
            (
                "prometheus-iq",
                ["route iq", "primary product", "product status", "routes"],
                "Route I Q is operational, Patent Pending, and the primary Prometheus product."
            ),
            (
                "github",
                ["prepare github backup", "github backup", "backup checklist", "safe backup"],
                "GitHub backup checklist prepared. First check git status, review changed files, confirm no secrets or env files are staged, run checks if needed, then ask Cruz before commit or push."
            ),
            (
                "github",
                ["github", "git hub", "repo", "repository"],
                "GitHub is active. Source code backup and project history are protected in the repository."
            ),
            (
                "cloudflare",
                ["cloudflare", "deployment", "deployed"],
                "Cloudflare is online. The protected deployment is active."
            ),
            (
                "domain-email",
                ["domain email", "domain", "email"],
                "Domain and email are operational."
            ),
            (
                "social-media",
                ["social media", "instagram"],
                "Social media is a read-only operating source for current Instagram analytics and content performance."
            ),
            (
                "llc-progress",
                ["llc", "business setup", "company setup"],
                "LLC progress is pending. The preparation path is documented."
            ),
            (
                "website",
                ["website", "site", "homepage"],
                "PrometheusRouteIQ.com is the public Route I Q presence and supports customer onboarding and enterprise confidence."
            ),
            (
                "founder-notes",
                ["founder notes", "notes", "signals", "daily brief", "today s brief", "todays brief", "give me today s brief", "what changed today", "daily progress log", "progress log"],
                "Route I Q is operational and Patent Pending. Gaia is paused. Athena is architecture only. Current work is deployment readiness, customer onboarding, enterprise hardening, and continuous operational improvement under Overwatch governance."
            ),
            (
                "voice-settings",
                ["voice settings", "voice", "settings"],
                "Voice settings are ready. Mark's ElevenLabs voice is configured through the local backend."
            )
        ]

        for command in commands {
            let normalizedPhrases = command.phrases.map { normalizeCommand($0) }
            if normalizedPhrases.contains(where: { phrase in
                normalized == phrase ||
                normalized.contains(phrase) ||
                (normalized.count >= 5 && phrase.contains(normalized))
            }) {
                return (command.nodeId, command.response)
            }
        }

        return nil
    }

    private func handleDirectSystemCommand(_ transcript: String) -> Bool {
        guard let command = directSystemCommand(for: transcript) else { return false }
        if command.nodeId == lastDirectCommandNodeId && Date().timeIntervalSince(lastDirectCommandAt) < 4 {
            return true
        }
        lastDirectCommandNodeId = command.nodeId
        lastDirectCommandAt = Date()

        log("Direct system command detected: \(command.nodeId).")
        openWebNode(command.nodeId)
        conversationHistory.append(ChatMessage(role: "user", content: transcript))
        conversationHistory.append(ChatMessage(role: "assistant", content: command.response))
        trimConversationHistory()
        speak(command.response)
        return true
    }

    private func openWebNode(_ nodeId: String) {
        let safeNodeId = nodeId.replacingOccurrences(of: "'", with: "")
        prometheusWebView?.evaluateJavaScript("window.prometheusOSOpenNode && window.prometheusOSOpenNode('\(safeNodeId)')")
    }

    private func detectClap(in buffer: AVAudioPCMBuffer) {
        guard let channel = buffer.floatChannelData?[0] else { return }
        let frameLength = Int(buffer.frameLength)
        guard frameLength > 0 else { return }

        var peak: Float = 0
        for index in 0..<frameLength {
            peak = max(peak, abs(channel[index]))
        }

        guard peak > 0.62 else { return }
        guard Date().timeIntervalSince(lastClapAt) > 1.4 else { return }
        lastClapAt = Date()

        DispatchQueue.main.async { [weak self] in
            self?.speak("Prometheus active. I am listening.")
        }
    }

    private func response(for transcript: String) -> String {
        if transcript.contains("good morning") {
            return founderGreeting
        }

        if transcript.contains("what should i do next") || transcript.contains("highest roi") {
            return "Your highest leverage task is to set today's mission, work the highest-value Route I Q prospects, maintain CRM stage continuity, and close the most important deployment or onboarding blocker."
        }

        if transcript.contains("route iq") {
            return "Route I Q is operational, Patent Pending, and the primary product."
        }

        return "Prometheus is online. I am listening, Mr. Garza."
    }

    private func extractWakeCommand(from transcript: String) -> String? {
        for phrase in wakePhrases {
            if let range = transcript.range(of: phrase) {
                let afterWake = transcript[range.upperBound...]
                    .trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters))
                return afterWake
            }
        }

        return nil
    }

    private func askAssistant(_ question: String) {
        let cleanQuestion = question.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanQuestion.isEmpty else { return }

        prepareForSpeech()
        assistantTask?.cancel()
        let requestGeneration = speechRequestGeneration
        log("Sending question to Prometheus assistant.")

        let outgoingHistory = conversationHistory
        var request = URLRequest(url: assistantEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 20

        do {
            request.httpBody = try JSONEncoder().encode(AssistantRequest(
                message: cleanQuestion,
                messages: outgoingHistory
            ))
        } catch {
            log("Assistant request encoding failed: \(error.localizedDescription).")
            speakAfterPrepared("I had trouble preparing that question.")
            return
        }

        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard error == nil else {
                Task { @MainActor [weak self] in
                    guard self?.speechRequestGeneration == requestGeneration else { return }
                    self?.log("Assistant network error: \(error?.localizedDescription ?? "unknown error").")
                    if let fallback = self?.nativeFounderReply(for: cleanQuestion) {
                        self?.speakAfterPrepared(fallback)
                    } else {
                        self?.speakAfterPrepared("I could not reach my assistant backend right now.")
                    }
                }
                return
            }

            guard let http = response as? HTTPURLResponse else {
                Task { @MainActor [weak self] in
                    guard self?.speechRequestGeneration == requestGeneration else { return }
                    self?.log("Assistant failed: missing HTTP response.")
                    if let fallback = self?.nativeFounderReply(for: cleanQuestion) {
                        self?.speakAfterPrepared(fallback)
                    } else {
                        self?.speakAfterPrepared("I did not receive a valid assistant response.")
                    }
                }
                return
            }

            guard let data, http.statusCode == 200 else {
                let reason = Self.safeProviderError(from: data)
                Task { @MainActor [weak self] in
                    guard self?.speechRequestGeneration == requestGeneration else { return }
                    self?.log("Assistant failed with status \(http.statusCode): \(reason)")
                    if let fallback = self?.nativeFounderReply(for: cleanQuestion) {
                        self?.speakAfterPrepared(fallback)
                    } else {
                        self?.speakAfterPrepared("The assistant request failed. \(reason)")
                    }
                }
                return
            }

            do {
                let assistantResponse = try JSONDecoder().decode(AssistantResponse.self, from: data)
                let decodedAnswer = assistantResponse.text.trimmingCharacters(in: .whitespacesAndNewlines)

                Task { @MainActor [weak self] in
                    guard let self else { return }
                    guard self.speechRequestGeneration == requestGeneration else { return }
                    let answer = decodedAnswer.isEmpty
                        ? (self.nativeFounderReply(for: cleanQuestion) ?? "I'm here. I did not get a complete answer, but we can keep going.")
                        : decodedAnswer
                    self.conversationHistory.append(ChatMessage(role: "user", content: cleanQuestion))
                    self.conversationHistory.append(ChatMessage(role: "assistant", content: answer))
                    self.trimConversationHistory()
                    self.log("Assistant response received. Sending answer to TTS.")
                    self.speakAfterPrepared(answer)
                }
            } catch {
                Task { @MainActor [weak self] in
                    guard self?.speechRequestGeneration == requestGeneration else { return }
                    self?.log("Assistant response decoding failed: \(error.localizedDescription).")
                    if let fallback = self?.nativeFounderReply(for: cleanQuestion) {
                        self?.speakAfterPrepared(fallback)
                    } else {
                        self?.speakAfterPrepared("I had trouble reading the assistant response.")
                    }
                }
            }
        }
        assistantTask = task
        task.resume()
    }

    private struct AssistantRequest: Codable {
        let message: String
        let messages: [ChatMessage]
    }

    private struct AssistantResponse: Codable {
        let text: String
    }

    private func trimConversationHistory() {
        if conversationHistory.count > 12 {
            conversationHistory = Array(conversationHistory.suffix(12))
        }
    }

    private func speak(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        prepareForSpeech()
        speakAfterPrepared(text)
    }

    private func speakAfterPrepared(_ text: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            resumeListeningAfterSpeech()
            return
        }
        log("Sending response to TTS provider: \(ttsProvider).")

        if ttsProvider != "browser" {
            speakWithPremiumBackend(text) { [weak self] success in
                if !success {
                    self?.log("Premium TTS failed. Falling back to macOS system voice.")
                    self?.prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Premium voice fallback', 'ElevenLabs failed. Browser voice is only being used for this response.', 'warn')")
                    self?.speakWithSystemVoice(text)
                }
            }
            return
        }

        speakWithSystemVoice(text)
    }

    private func stopSpeaking(source: String = "voice command", resumeListening: Bool = true) {
        speechRequestGeneration += 1
        audioPlaybackGeneration += 1
        assistantTask?.cancel()
        assistantTask = nil
        premiumTtsTask?.cancel()
        premiumTtsTask = nil
        premiumAudioPlayer?.stop()
        premiumAudioPlayer = nil
        if speechSynthesizer.isSpeaking {
            speechSynthesizer.stopSpeaking(at: .immediate)
        }
        isSpeaking = false
        shouldResumeListeningAfterSpeech = false
        log("Speech interrupted by \(source).")
        if resumeListening {
            prometheusWebView?.evaluateJavaScript("window.prometheusOSInterruptSpeech && window.prometheusOSInterruptSpeech(\(Self.javascriptStringLiteral(source)))")
        }
        prometheusWebView?.evaluateJavaScript("window.prometheusOSSetVoiceDebug && window.prometheusOSSetVoiceDebug('Stopped', 'speech interrupted', 'ok')")
        if resumeListening {
            startListening()
        }
    }

    private func speakWithPremiumBackend(_ text: String, attempt: Int = 0, completion: @escaping (Bool) -> Void) {
        let requestGeneration = speechRequestGeneration
        var request = URLRequest(url: ttsEndpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30

        var body: [String: String] = [
            "text": text,
            "provider": ttsProvider
        ]

        let requestedVoice = ttsPreferredVoice.trimmingCharacters(in: .whitespacesAndNewlines)
        if !requestedVoice.isEmpty {
            body["preferredVoice"] = requestedVoice
        } else if ttsProvider == "openai" {
            body["preferredVoice"] = "onyx"
        }

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            completion(false)
            return
        }

        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard error == nil else {
                DispatchQueue.main.async {
                    guard self?.speechRequestGeneration == requestGeneration else { return }
                    self?.log("Premium TTS network error: \(error?.localizedDescription ?? "unknown error").")
                    if attempt < 2 {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            guard self?.speechRequestGeneration == requestGeneration else { return }
                            self?.speakWithPremiumBackend(text, attempt: attempt + 1, completion: completion)
                        }
                        return
                    }
                    completion(false)
                }
                return
            }

            guard let http = response as? HTTPURLResponse else {
                DispatchQueue.main.async {
                    guard self?.speechRequestGeneration == requestGeneration else { return }
                    self?.log("Premium TTS failed: missing HTTP response.")
                    completion(false)
                }
                return
            }

            guard let data, http.statusCode == 200 else {
                let reason = Self.safeProviderError(from: data)
                DispatchQueue.main.async {
                    guard self?.speechRequestGeneration == requestGeneration else { return }
                    self?.log("Premium TTS failed with status \(http.statusCode): \(reason)")
                    if attempt < 1 && http.statusCode >= 500 {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                            guard self?.speechRequestGeneration == requestGeneration else { return }
                            self?.speakWithPremiumBackend(text, attempt: attempt + 1, completion: completion)
                        }
                        return
                    }
                    completion(false)
                }
                return
            }

            DispatchQueue.main.async {
                guard self?.speechRequestGeneration == requestGeneration else { return }
                do {
                    self?.premiumAudioPlayer = try AVAudioPlayer(data: data)
                    self?.premiumAudioPlayer?.delegate = self
                    self?.premiumAudioPlayer?.prepareToPlay()
                    if self?.premiumAudioPlayer?.play() == true {
                        self?.log("Premium TTS audio playback started.")
                        self?.scheduleAudioPlaybackWatchdog()
                        completion(true)
                    } else {
                        self?.log("Premium TTS audio player did not start.")
                        completion(false)
                    }
                } catch {
                    self?.log("Premium TTS audio playback error: \(error.localizedDescription).")
                    completion(false)
                }
            }
        }
        premiumTtsTask = task
        task.resume()
    }

    private func speakWithSystemVoice(_ text: String) {
        let utterance = AVSpeechUtterance(string: text)
        utterance.rate = 0.48
        utterance.pitchMultiplier = 0.85
        utterance.volume = 1.0

        if let voice = naturalMaleVoice() {
            utterance.voice = voice
        }

        speechSynthesizer.speak(utterance)
    }

    private func prepareForSpeech() {
        speechRequestGeneration += 1
        isSpeaking = true
        if audioEngine.isRunning {
            shouldResumeListeningAfterSpeech = true
            stopListening()
        }
    }

    private func resumeListeningAfterSpeech() {
        isSpeaking = false
        shouldResumeListeningAfterSpeech = false

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.startListening()
        }
    }

    private func scheduleAudioPlaybackWatchdog() {
        audioPlaybackGeneration += 1
        let generation = audioPlaybackGeneration
        let duration = premiumAudioPlayer?.duration ?? 0
        let timeout = max(8.0, duration + 3.0)
        log("Premium TTS playback monitor scheduled in \(String(format: "%.1f", timeout)) seconds.")

        DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { [weak self] in
            guard let self else { return }
            guard self.audioPlaybackGeneration == generation else { return }
            guard self.isSpeaking else { return }

            if self.premiumAudioPlayer?.isPlaying == true {
                let current = self.premiumAudioPlayer?.currentTime ?? 0
                let total = self.premiumAudioPlayer?.duration ?? 0
                self.log("Premium TTS playback still active at \(String(format: "%.1f", current))/\(String(format: "%.1f", total)) seconds; keeping audio alive.")
                self.scheduleAudioPlaybackWatchdog()
                return
            }

            self.log("Premium TTS playback monitor found playback stopped without finish callback; resuming listening.")
            self.resumeListeningAfterSpeech()
        }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor [weak self] in
            self?.log("Premium TTS audio playback finished.")
            self?.audioPlaybackGeneration += 1
            self?.resumeListeningAfterSpeech()
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor [weak self] in
            self?.log("Premium TTS audio decode error: \(error?.localizedDescription ?? "unknown error").")
            self?.audioPlaybackGeneration += 1
            self?.resumeListeningAfterSpeech()
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.log("System voice playback finished.")
            self?.resumeListeningAfterSpeech()
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor [weak self] in
            self?.log("System voice playback canceled.")
            self?.resumeListeningAfterSpeech()
        }
    }

    nonisolated private static func safeProviderError(from data: Data?) -> String {
        guard
            let data,
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return "No provider error body."
        }

        if let errorText = json["error"] as? String {
            return errorText.replacingOccurrences(of: "sk-[A-Za-z0-9_-]+", with: "[REDACTED]", options: .regularExpression)
        }

        guard let error = json["error"] as? [String: Any] else {
            return "No provider error body."
        }

        if let message = error["message"] as? String {
            return message.replacingOccurrences(of: "sk-[A-Za-z0-9_-]+", with: "[REDACTED]", options: .regularExpression)
        }

        if let type = error["type"] as? String {
            return type
        }

        return "Unspecified provider error."
    }

    private func log(_ message: String) {
        let safeMessage = message.replacingOccurrences(
            of: "sk-[A-Za-z0-9_-]+",
            with: "[REDACTED]",
            options: .regularExpression
        )
        let line = "\(ISO8601DateFormatter().string(from: Date())) \(safeMessage)\n"

        do {
            try FileManager.default.createDirectory(
                at: logFileURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )

            if !FileManager.default.fileExists(atPath: logFileURL.path) {
                FileManager.default.createFile(atPath: logFileURL.path, contents: nil)
            }

            let handle = try FileHandle(forWritingTo: logFileURL)
            try handle.seekToEnd()
            if let data = line.data(using: .utf8) {
                try handle.write(contentsOf: data)
            }
            try handle.close()
        } catch {
            // Logging must never interrupt the assistant.
        }
    }

    private func naturalMaleVoice() -> AVSpeechSynthesisVoice? {
        let preferredNames = ["Daniel", "Reed", "Eddy", "Grandpa", "Fred", "Alex"]
        let voices = AVSpeechSynthesisVoice.speechVoices()

        for name in preferredNames {
            if let voice = voices.first(where: { $0.name.localizedCaseInsensitiveContains(name) && $0.language.hasPrefix("en") }) {
                return voice
            }
        }

        return AVSpeechSynthesisVoice(language: "en-US")
    }

    private static let loadingHTML = """
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        html, body {
          margin: 0;
          width: 100%;
          height: 100%;
          background: radial-gradient(circle at center, #143f38 0%, #061513 42%, #020504 100%);
          color: #f8f3df;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
          overflow: hidden;
        }
        body {
          display: grid;
          place-items: center;
        }
        .core {
          width: 180px;
          height: 180px;
          border-radius: 50%;
          background: radial-gradient(circle, #fff9df 0 10%, #ffbf47 11% 33%, #ef6c24 34% 63%, rgba(36, 235, 201, 0.15) 64% 100%);
          box-shadow: 0 0 80px rgba(255, 153, 37, 0.45), 0 0 140px rgba(36, 235, 201, 0.18);
          animation: pulse 1.8s ease-in-out infinite;
        }
        .label {
          margin-top: 28px;
          text-align: center;
          letter-spacing: 0.18em;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          opacity: 0.82;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(0.96); filter: brightness(0.92); }
          50% { transform: scale(1.04); filter: brightness(1.12); }
        }
      </style>
    </head>
    <body>
      <main>
        <div class="core"></div>
        <div class="label">Prometheus waking</div>
      </main>
    </body>
    </html>
    """
}

@main
enum PrometheusCompanionMain {
    static func main() {
        let app = PrometheusCompanionApplication.shared
        let delegate = PrometheusCompanion()
        app.delegate = delegate
        delegate.startCompanionIfNeeded()
        app.run()
    }
}
