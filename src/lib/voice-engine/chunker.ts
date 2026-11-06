/**
 * Découpe en phrases d'une réponse qui arrive mot par mot (LLM en flux).
 *
 * Chaque phrase complète part aussitôt en synthèse vocale : l'agent commence
 * à parler dès sa première phrase au lieu d'attendre la réponse entière. La
 * première phrase peut être courte (réactivité), les suivantes sont groupées
 * pour garder une intonation naturelle.
 */

/** Abréviations suivies d'un point qui ne terminent pas une phrase. */
const ABBREVIATION = /(?:^|\s)(?:M|Mme|Mlle|Mmes|MM|Dr|Pr|Me|St|Ste|av|bd|n°|p|cf|ex|env|tél|Tél)\.$/;

const FIRST_MIN = 12;
const NEXT_MIN = 40;
/** Au-delà, on coupe sur une virgule ou un espace pour ne pas faire attendre. */
const MAX_LEN = 220;

export class SentenceChunker {
  private buf = "";
  private first = true;

  /** Ajoute du texte reçu ; renvoie les phrases désormais complètes. */
  push(delta: string): string[] {
    this.buf += delta;
    const out: string[] = [];
    for (;;) {
      const cut = this.findCut();
      if (cut < 0) break;
      const sentence = this.buf.slice(0, cut).trim();
      this.buf = this.buf.slice(cut).replace(/^\s+/, "");
      if (sentence) {
        out.push(sentence);
        this.first = false;
      }
    }
    return out;
  }

  /** Fin de la réponse : renvoie le reste (éventuellement sans ponctuation finale). */
  flush(): string[] {
    const rest = this.buf.trim();
    this.buf = "";
    return rest ? [rest] : [];
  }

  private findCut(): number {
    const min = this.first ? FIRST_MIN : NEXT_MIN;
    // Ponctuation forte suivie d'un espace (la suite est déjà arrivée), ou retour à la ligne.
    const re = /[.!?…]+(?=\s)|[;:](?=\s)|\n/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.buf))) {
      const end = m.index + m[0].length;
      if (end < min) continue;
      if (m[0] === "." && ABBREVIATION.test(this.buf.slice(0, end))) continue;
      return end;
    }
    if (this.buf.length > MAX_LEN) {
      const window = this.buf.slice(0, MAX_LEN);
      const comma = window.lastIndexOf(", ");
      if (comma > MAX_LEN / 2) return comma + 1;
      const space = window.lastIndexOf(" ");
      if (space > MAX_LEN / 2) return space;
      return MAX_LEN;
    }
    return -1;
  }
}
