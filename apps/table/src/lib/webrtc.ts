import type {
  FeedSignaling,
  IceServerConfig,
  SignalPayload,
} from "@ga/contracts";

export interface FeedConnectionOptions {
  /** `receiver` is the desktop viewing the opponent's Feed; `publisher` is the Capture Device. */
  role: "receiver" | "publisher";
  signaling: FeedSignaling;
  iceServers: IceServerConfig[];
  /** Receiver only: called with the remote stream when the Feed arrives. */
  onTrack?: (stream: MediaStream) => void;
}

/**
 * One RTCPeerConnection per Feed. Roles are fixed, so there is no offer/answer
 * glare: the receiver always makes the offer (and re-offers with iceRestart
 * after a network change), the publisher always answers.
 *
 * Behavior is browser-verified rather than unit-tested (see apps/table/AGENTS.md);
 * the shape it consumes lives in @ga/contracts.
 */
export class FeedConnection {
  private readonly pc: RTCPeerConnection;
  private readonly role: "receiver" | "publisher";
  private readonly signaling: FeedSignaling;
  private readonly onTrack?: (stream: MediaStream) => void;
  private readonly unsubscribe: () => void;
  private pendingCandidates: RTCIceCandidateInit[] = [];

  constructor(options: FeedConnectionOptions) {
    this.role = options.role;
    this.signaling = options.signaling;
    this.onTrack = options.onTrack;

    this.pc = new RTCPeerConnection({ iceServers: options.iceServers });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.send({ kind: "ice", candidate: event.candidate.candidate });
      }
    };

    this.pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (this.role === "receiver" && stream) {
        this.onTrack?.(stream);
      }
    };

    this.unsubscribe = this.signaling.onSignal((payload) => {
      void this.handleSignal(payload);
    });
  }

  /** Publisher: attach the local camera before the offer arrives. */
  public addTrack(track: MediaStreamTrack): void {
    this.pc.addTrack(track);
  }

  /** Receiver: begin the exchange. */
  public async offer(): Promise<void> {
    await this.negotiate(undefined);
  }

  /** Receiver: renegotiate after a network change. */
  public async restartIce(): Promise<void> {
    await this.negotiate({ iceRestart: true });
  }

  public close(): void {
    this.unsubscribe();
    this.pc.close();
  }

  private async negotiate(options?: RTCOfferOptions): Promise<void> {
    const offer = await this.pc.createOffer(options);
    await this.pc.setLocalDescription(offer);
    this.sendLocalDescription("offer");
  }

  private async handleSignal(payload: SignalPayload): Promise<void> {
    try {
      switch (payload.kind) {
        case "offer":
          if (this.role === "publisher") {
            await this.pc.setRemoteDescription({ type: "offer", sdp: payload.sdp });
            await this.flushPendingCandidates();
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.sendLocalDescription("answer");
          }
          break;
        case "answer":
          if (this.role === "receiver") {
            await this.pc.setRemoteDescription({ type: "answer", sdp: payload.sdp });
            await this.flushPendingCandidates();
          }
          break;
        case "ice":
          await this.handleIceCandidate(payload.candidate);
          break;
      }
    } catch (err) {
      // A signaling race (e.g. a candidate arriving mid-renegotiation) surfaces
      // through connection state rather than a thrown error.
      console.warn("[webrtc] failed to apply signal", err);
    }
  }

  private async handleIceCandidate(candidate: string): Promise<void> {
    const init: RTCIceCandidateInit = { candidate };
    if (!this.pc.remoteDescription) {
      this.pendingCandidates.push(init);
      return;
    }
    await this.pc.addIceCandidate(init);
  }

  private async flushPendingCandidates(): Promise<void> {
    while (this.pendingCandidates.length > 0) {
      const next = this.pendingCandidates.shift();
      if (next) await this.pc.addIceCandidate(next);
    }
  }

  private sendLocalDescription(kind: "offer" | "answer"): void {
    const sdp = this.pc.localDescription?.sdp;
    if (sdp) {
      this.signaling.send({ kind, sdp });
    }
  }
}
