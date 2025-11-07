// Genera tono con Tone.js o usa pistas pregrabadas si existen
function playTone(freq = 432, volume = 0.5) {
  try {
    const sampleMap = {
      396: "audio/396hz.mp3",
      417: "audio/417hz.mp3",
      432: "audio/432hz.mp3",
      528: "audio/528hz.mp3",
      639: "audio/639hz.mp3",
      741: "audio/741hz.mp3",
      852: "audio/852hz.mp3",
      963: "audio/963hz.mp3",
    };
    if (sampleMap[freq]) {
      const a = new Audio(sampleMap[freq]);
      a.volume = volume;
      a.play();
    } else {
      const synth = new Tone.Synth().toDestination();
      synth.volume.value = Tone.gainToDb(volume);
      synth.triggerAttackRelease(freq, "2n");
    }
  } catch (err) {
    console.error("Error reproduciendo tono:", err);
  }
}
