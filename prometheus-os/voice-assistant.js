export class VoiceAssistant {
  constructor({ onTranscript, onWake, onClap, onStateChange, onDebug } = {}) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    this.onTranscript = onTranscript;
    this.onWake = onWake;
    this.onClap = onClap;
    this.onStateChange = onStateChange;
    this.onDebug = onDebug;
    this.autoRead = true;
    this.selectedVoiceName = "";
    this.voices = [];
    this.keepListening = false;
    this.isListening = false;
    this.isSpeaking = false;
    this.restartTimer = 0;
    this.audioContext = null;
    this.clapStream = null;
    this.clapAnalyser = null;
    this.clapRaf = 0;
    this.lastClapAt = 0;
    this.wakePhrases = [
      "good morning prometheus",
      "hey prometheus",
      "prometheus",
      "promethius",
      "prometheous",
      "permetheus"
    ];

    if (this.recognition) {
      this.recognition.lang = "en-US";
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.recognition.addEventListener("start", () => {
        this.debug("microphone active", "browser speech recognition started");
        this.setState("listening");
      });
      this.recognition.addEventListener("end", () => {
        this.isListening = false;
        this.debug("speech recognition ended", this.keepListening ? "restart scheduled" : "stopped");
        this.setState(this.keepListening ? "standby" : "sleeping");
        this.scheduleRestart();
      });
      this.recognition.addEventListener("error", (event) => {
        this.isListening = false;
        this.debug("error/fallback reason", event?.error || "speech recognition error");
        this.setState("voice recognition unavailable");
        this.scheduleRestart(1400);
      });
      this.recognition.addEventListener("result", (event) => {
        const results = Array.from(event.results);
        const transcript = results
          .map((result) => result[0]?.transcript || "")
          .join(" ")
          .trim();
        const finalTranscript = results
          .filter((result) => result.isFinal)
          .map((result) => result[0]?.transcript || "")
          .join(" ")
          .trim();
        const heard = finalTranscript || transcript;
        if (!heard) return;
        this.debug("speech recognition transcript", heard);
        const wake = this.extractWakeCommand(heard);
        if (wake.woke) {
          this.debug("wake phrase detected", wake.phrase);
          if (wake.command) this.debug("command detected", wake.command);
          this.onWake?.(heard, wake);
          return;
        }
        if (finalTranscript) {
          this.debug("command detected", finalTranscript);
          this.onTranscript?.(finalTranscript);
        }
      });
    }

    if (this.canSpeak) {
      this.loadVoices();
      window.speechSynthesis.addEventListener?.("voiceschanged", () => this.loadVoices());
    }
  }

  get canListen() {
    return Boolean(this.recognition);
  }

  get canSpeak() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  loadVoices() {
    this.voices = window.speechSynthesis.getVoices();
    return this.voices;
  }

  setVoice(name) {
    this.selectedVoiceName = name;
  }

  extractWakeCommand(transcript) {
    const lower = this.normalizeSpeech(transcript);
    const phrase = this.wakePhrases.find((item) => lower.includes(item));
    if (!phrase) return { woke: false, command: "", phrase: "" };
    const phrasePattern = phrase
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("\\s+");
    const match = new RegExp(phrasePattern, "i").exec(transcript);
    const commandStart = match ? match.index + match[0].length : lower.indexOf(phrase) + phrase.length;
    const command = transcript.slice(commandStart).replace(/^[,.\s]+/, "").trim();
    return { woke: true, command, phrase };
  }

  startAlwaysListening() {
    this.keepListening = true;
    return this.listen();
  }

  stopAlwaysListening() {
    this.keepListening = false;
    window.clearTimeout(this.restartTimer);
    this.stop();
  }

  scheduleRestart(delay = 650) {
    window.clearTimeout(this.restartTimer);
    if (!this.keepListening || this.isSpeaking) return;
    this.restartTimer = window.setTimeout(() => this.listen(), delay);
  }

  listen() {
    if (!this.recognition) {
      this.setState("type instead");
      return false;
    }
    if (this.isListening) {
      this.setState("listening");
      return true;
    }
    try {
      window.clearTimeout(this.restartTimer);
      this.isListening = true;
      this.recognition.start();
      return true;
    } catch {
      this.isListening = false;
      this.setState("already listening");
      return false;
    }
  }

  speak(text) {
    if (!this.canSpeak || !text) return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const selected = this.voices.find((voice) => voice.name === this.selectedVoiceName);
    if (selected) utterance.voice = selected;
    utterance.rate = 0.9;
    utterance.pitch = 0.78;
    utterance.volume = 0.95;
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.setState("speaking");
    };
    utterance.onend = () => {
      this.isSpeaking = false;
      this.setState(this.keepListening ? "standby" : "sleeping");
      this.scheduleRestart(450);
    };
    utterance.onerror = () => {
      this.isSpeaking = false;
      this.setState(this.keepListening ? "standby" : "sleeping");
      this.scheduleRestart(450);
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }

  async startClapDetection({ threshold = 0.34 } = {}) {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      this.setState("clap unavailable");
      return false;
    }
    try {
      this.clapStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.clapStream);
      this.clapAnalyser = this.audioContext.createAnalyser();
      this.clapAnalyser.fftSize = 1024;
      source.connect(this.clapAnalyser);
      const data = new Uint8Array(this.clapAnalyser.fftSize);

      const tick = () => {
        this.clapAnalyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const sample of data) {
          peak = Math.max(peak, Math.abs(sample - 128) / 128);
        }
        const now = Date.now();
        if (peak > threshold && now - this.lastClapAt > 850) {
          this.lastClapAt = now;
          this.onClap?.({ peak });
          if (this.keepListening) this.listen();
        }
        this.clapRaf = requestAnimationFrame(tick);
      };
      tick();
      return true;
    } catch {
      this.setState("clap unavailable");
      return false;
    }
  }

  stopClapDetection() {
    cancelAnimationFrame(this.clapRaf);
    this.clapStream?.getTracks().forEach((track) => track.stop());
    this.clapStream = null;
    this.clapAnalyser = null;
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  stop() {
    window.clearTimeout(this.restartTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Browser may throw if recognition is already stopped.
      }
    }
    if (this.canSpeak) window.speechSynthesis.cancel();
    this.isListening = false;
    this.isSpeaking = false;
    this.setState("sleeping");
  }

  setState(state) {
    this.onStateChange?.(state);
  }

  normalizeSpeech(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  debug(stage, message = "") {
    this.onDebug?.(stage, message);
  }
}
