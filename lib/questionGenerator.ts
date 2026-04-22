export interface MathQuestion {
  question: string;
  options: number[];
  correctAnswer: number;
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateWrongOptions = (correct: number): number[] => {
  const opts = new Set<number>();
  while (opts.size < 3) {
    // For smaller numbers, use smaller offsets
    const scale = Math.abs(correct) < 20 ? 5 : (Math.abs(correct) < 100 ? 15 : 30);
    const offset = randomInt(-scale, scale);
    if (offset === 0) continue;
    const wrong = correct + offset;
    
    // Attempt to avoid negative options if correct answer is positive, 
    // unless the level is high (SMP/SMA)
    // We'll let SMP/SMA have negative options
    opts.add(wrong);
  }
  return Array.from(opts);
};

const shuffleArray = (arr: number[]) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export const generateMathQuestions = (kelas: number, jumlahSoal: number): MathQuestion[] => {
  const questions: MathQuestion[] = [];

  for (let i = 0; i < jumlahSoal; i++) {
    let qStr = "";
    let ans = 0;

    if (kelas <= 2) {
      // Kelas 1-2: Penjumlahan & pengurangan dasar (1-50)
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const a = randomInt(1, 25);
        const b = randomInt(1, 25);
        qStr = `${a} + ${b}`;
        ans = a + b;
      } else {
        const a = randomInt(10, 50);
        const b = randomInt(1, a); // ensure positive answer
        qStr = `${a} - ${b}`;
        ans = a - b;
      }
    } else if (kelas <= 4) {
      // Kelas 3-4: Penjumlahan, pengurangan, perkalian dasar, pembagian dasar
      const op = Math.floor(Math.random() * 4); // 0=add, 1=sub, 2=mul, 3=div
      
      if (op === 0) {
        const a = randomInt(10, 100);
        const b = randomInt(10, 100);
        qStr = `${a} + ${b}`;
        ans = a + b;
      } else if (op === 1) {
        const a = randomInt(20, 100);
        const b = randomInt(1, a);
        qStr = `${a} - ${b}`;
        ans = a - b;
      } else if (op === 2) {
        const a = randomInt(2, 12);
        const b = randomInt(2, 12);
        qStr = `${a} x ${b}`;
        ans = a * b;
      } else {
        const b = randomInt(2, 10);
        const ansCandidate = randomInt(2, 12);
        const a = b * ansCandidate;
        qStr = `${a} ÷ ${b}`;
        ans = ansCandidate;
      }
    } else if (kelas <= 6) {
      // Kelas 5-6: SD Lanjut
      const op = Math.floor(Math.random() * 4);
      
      if (op === 0) {
        const a = randomInt(50, 500);
        const b = randomInt(50, 500);
        qStr = `${a} + ${b}`;
        ans = a + b;
      } else if (op === 1) {
        const a = randomInt(100, 500);
        const b = randomInt(10, a);
        qStr = `${a} - ${b}`;
        ans = a - b;
      } else if (op === 2) {
        const a = randomInt(10, 25);
        const b = randomInt(5, 20);
        qStr = `${a} x ${b}`;
        ans = a * b;
      } else {
        const b = randomInt(5, 20);
        const ansCandidate = randomInt(10, 25);
        const a = b * ansCandidate;
        qStr = `${a} ÷ ${b}`;
        ans = ansCandidate;
      }
    } else if (kelas <= 9) {
      // SMP (Kelas 7-9)
      const op = Math.floor(Math.random() * 3); // 0: Aljabar, 1: Persentase, 2: Diskon

      if (op === 0) {
        // Aljabar: ax + b = c
        const a = randomInt(2, 6);
        const x = randomInt(2, 10);
        const b = randomInt(1, 20);
        const c = a * x + b;
        qStr = `Jika ${a}x + ${b} = ${c}, berapakah nilai x?`;
        ans = x;
      } else if (op === 1) {
        // Persentase: x% dari y
        const percentages = [10, 20, 25, 30, 40, 50, 60, 75];
        const p = percentages[Math.floor(Math.random() * percentages.length)];
        const base = randomInt(1, 20) * 50;
        qStr = `Berapakah ${p}% dari ${base}?`;
        ans = (p / 100) * base;
      } else {
        // Diskon
        const prices = [50000, 100000, 150000, 200000, 250000, 500000];
        const price = prices[Math.floor(Math.random() * prices.length)];
        const discount = randomInt(1, 9) * 10;
        qStr = `Harga barang Rp ${price.toLocaleString('id-ID')} diskon ${discount}%. Berapa harga setelah diskon?`;
        ans = price - (price * (discount / 100));
      }
    } else {
      // SMA/SMK (Kelas 10-12)
      const op = Math.floor(Math.random() * 3); // 0: Barisan, 1: Eksponen, 2: Persamaan Kuadrat

      if (op === 0) {
        // Barisan Aritmatika: Un = a + (n-1)d
        const a = randomInt(1, 10);
        const d = randomInt(2, 6);
        const n = randomInt(5, 12);
        qStr = `Suku ke-${n} dari barisan ${a}, ${a+d}, ${a+2*d}... adalah?`;
        ans = a + (n - 1) * d;
      } else if (op === 1) {
        // Eksponen: n^a * n^b = n^(a+b)
        const baseChoices = [2, 3];
        const base = baseChoices[Math.floor(Math.random() * baseChoices.length)];
        const p1 = randomInt(2, 4);
        const p2 = randomInt(2, 3);
        const resultPower = p1 + p2;
        qStr = `Nilai dari ${base} pangkat ${p1} x ${base} pangkat ${p2} adalah?`;
        ans = Math.pow(base, resultPower);
      } else {
        // Persamaan Kuadrat: x^2 - Sx + P = 0
        // Hasil kali akar = c/a, penjumlahan akar = -b/a
        let x1 = randomInt(-5, 5);
        let x2 = randomInt(-5, 5);
        if (x1 === 0 && x2 === 0) x1 = 1;
        
        const S = x1 + x2;
        const P = x1 * x2;
        
        const type = Math.random() > 0.5;
        // x^2 - Sx + P = 0
        // b = -S, c = P
        const b = -S;
        const c = P;
        
        const bStr = b === 0 ? "" : (b > 0 ? ` + ${b}x` : ` - ${Math.abs(b)}x`);
        const cStr = c === 0 ? "" : (c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`);
        
        if (type) {
          qStr = `Jika persamaan x²${bStr}${cStr} = 0, berapakah hasil kali akar-akarnya?`;
          ans = P;
        } else {
          qStr = `Jika persamaan x²${bStr}${cStr} = 0, berapakah penjumlahan akar-akarnya?`;
          ans = S;
        }
      }
    }

    const options = generateWrongOptions(ans);
    options.push(ans);
    shuffleArray(options);

    questions.push({
      question: qStr,
      correctAnswer: ans,
      options: options
    });
  }

  return questions;
};
