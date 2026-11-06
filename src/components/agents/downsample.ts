/**
 * Rééchantillonnage du micro (44,1 / 48 kHz…) vers 8 kHz, par moyenne.
 *
 * Le navigateur livre l'audio par petits blocs (128 échantillons) : la phase
 * fractionnaire et la fin non consommée de chaque bloc sont conservées d'un
 * bloc à l'autre. Sinon on perd des échantillons (fréquence effective
 * < 8 kHz) et on crée une discontinuité à chaque bloc (bourdonnement).
 */
export function createDownsampler(inputRate: number, outputRate = 8000) {
  const ratio = inputRate / outputRate;
  let tail: number[] = [];
  let pos = 0;

  return function push(input: ArrayLike<number>): number[] {
    const buf = tail.length ? tail.concat(Array.from(input)) : Array.from(input);
    const out: number[] = [];
    while (pos + ratio <= buf.length) {
      const start = Math.floor(pos);
      const end = Math.max(start + 1, Math.floor(pos + ratio));
      let sum = 0;
      for (let j = start; j < end; j++) sum += buf[j];
      out.push(sum / (end - start));
      pos += ratio;
    }
    const consumed = Math.floor(pos);
    tail = buf.slice(consumed);
    pos -= consumed;
    return out;
  };
}
