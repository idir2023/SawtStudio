global.MPEGMode = require('lamejs/src/js/MPEGMode.js');
global.Lame = require('lamejs/src/js/Lame.js');

const lamejs = require('lamejs');
const encoder = new lamejs.Mp3Encoder(1, 44100, 128);
const samples = new Int16Array(1152);
const mp3buf = encoder.encodeBuffer(samples);
console.log("Success! Buffer length:", mp3buf.length);
