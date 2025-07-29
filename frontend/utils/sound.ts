export const playSound = (name: "send" | "receive") => {
    const audio = new Audio(`/sounds/${name}.mp3`);
    audio.volume = 0.7;
    audio.play().catch(() => {});
  };