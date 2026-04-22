export interface MathQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateWrongOptions(correct: number): string[] {
  const options = new Set<string>();
  while (options.size < 3) {
    const wrong = correct + randomInt(-5, 5);
    if (wrong !== correct) options.add(wrong.toString());
  }
  return Array.from(options);
}

export function generateMathQuestions(kelas: number, count: number): MathQuestion[] {
  const questions: MathQuestion[] = [];
  
  for (let i = 0; i < count; i++) {
    let question = "";
    let correctAnswer = "";
    let options: string[] = [];

    if (kelas <= 6) {
      // SD Levels
      const a = randomInt(1, 10 * kelas);
      const b = randomInt(1, 10 * kelas);
      const op = kelas > 2 ? (Math.random() > 0.5 ? '+' : '-') : '+';
      
      const result = op === '+' ? a + b : a - b;
      question = `${a} ${op} ${b} = ?`;
      correctAnswer = result.toString();
      options = [...generateWrongOptions(result), correctAnswer];
    } else if (kelas <= 9) {
      // SMP Levels
      const type = randomInt(1, 3);
      if (type === 1) {
        // Aljabar: ax + b = c
        const x = randomInt(1, 10);
        const a = randomInt(2, 5);
        const b = randomInt(1, 20);
        const c = a * x + b;
        question = `Jika ${a}x + ${b} = ${c}, berapakah nilai x?`;
        correctAnswer = x.toString();
        options = [...generateWrongOptions(x), correctAnswer];
      } else if (type === 2) {
        // Persentase
        const base = randomInt(1, 10) * 20;
        const percent = randomInt(1, 5) * 10;
        const result = (percent / 100) * base;
        question = `Berapa ${percent}% dari ${base}?`;
        correctAnswer = result.toString();
        options = [...generateWrongOptions(result), correctAnswer];
      } else {
        // Diskon
        const price = randomInt(10, 50) * 10000;
        const diskon = randomInt(1, 5) * 10;
        const result = price - (price * diskon / 100);
        question = `Harga Rp ${price.toLocaleString('id-ID')} diskon ${diskon}%. Harga akhir?`;
        correctAnswer = result.toString();
        options = [
          (result + 5000).toString(),
          (result - 5000).toString(),
          (price - 5000).toString(),
          correctAnswer
        ];
      }
    } else {
      // SMA/SMK Levels
      const type = randomInt(1, 3);
      if (type === 1) {
        // Barisan Aritmatika
        const a = randomInt(1, 10);
        const b = randomInt(2, 5);
        const n = randomInt(5, 15);
        const result = a + (n - 1) * b;
        question = `Suku ke-${n} dari barisan ${a}, ${a+b}, ${a+2*b}, ... adalah?`;
        correctAnswer = result.toString();
        options = [...generateWrongOptions(result), correctAnswer];
      } else if (type === 2) {
        // Eksponen
        const base = randomInt(2, 3);
        const exp = randomInt(3, 5);
        const result = Math.pow(base, exp);
        question = `Berapakah hasil dari ${base}^${exp}?`;
        correctAnswer = result.toString();
        options = [...generateWrongOptions(result), correctAnswer];
      } else {
        // Persamaan Kuadrat (Akar-akar)
        let x1 = randomInt(-5, 5);
        let x2 = randomInt(-5, 5);
        if (x1 === 0 && x2 === 0) x1 = 1;
        const S = x1 + x2;
        const P = x1 * x2;
        question = `Jika x1 dan x2 akar dari x² - (${S})x + (${P}) = 0, berapakah x1 + x2?`;
        correctAnswer = S.toString();
        options = [...generateWrongOptions(S), correctAnswer];
      }
    }

    questions.push({
      question,
      options: options.sort(() => Math.random() - 0.5),
      correctAnswer
    });
  }
  
  return questions;
}
