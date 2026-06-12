export async function fireConfetti() {
  if (typeof window === 'undefined') return;
  const confetti = (await import('canvas-confetti')).default;
  confetti({
    particleCount: 160,
    spread: 80,
    origin: { y: 0.55 },
    colors: ['#6C63FF', '#FF6584', '#2ECC71', '#F59E0B', '#3498DB'],
  });
  // second burst slightly delayed for depth
  setTimeout(() => {
    confetti({
      particleCount: 60,
      spread: 50,
      origin: { x: 0.2, y: 0.6 },
      colors: ['#6C63FF', '#FF6584', '#2ECC71'],
    });
    confetti({
      particleCount: 60,
      spread: 50,
      origin: { x: 0.8, y: 0.6 },
      colors: ['#F59E0B', '#3498DB', '#FF6584'],
    });
  }, 250);
}
