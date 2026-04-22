export interface MathQuestion {
  question: string;
  options: number[];
  correctAnswer: number;
}

const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateWrongOptions = (correct: number): number[] => {
  const opts = new Set<number>();
  while (opts.size < 3) {
    // Offset randomly between -10 to +10, except 0
    const offset = randomInt(-10, 10);
    if (offset === 0) continue;
    const wrong = correct + offset;
    
    // Attempt to avoid negative options if correct answer is positive, 
    // to keep it simple for kids, mostly
    if (correct >= 0 && wrong < 0) continue; 
    
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
        // Pembagian dasar: hasil bulat
        const b = randomInt(2, 10);
        const ansCandidate = randomInt(2, 12);
        const a = b * ansCandidate;
        qStr = `${a} ÷ ${b}`;
        ans = ansCandidate;
      }
    } else {
      // Kelas 5-6: Operasi campuran, angka lebih besar
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
