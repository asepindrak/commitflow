export const playSound = (src: string, isPlaySound: boolean) => {
  if (!isPlaySound) return;
  const audio = new Audio(src);
  audio.volume = 0.2;
  audio.play().catch((e: any) => {
    console.log(e);
  });
};
