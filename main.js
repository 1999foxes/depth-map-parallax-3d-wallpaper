// https://github.com/1999foxes
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';


// scene set up

var scene = new THREE.Scene();

var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

var renderer = new THREE.WebGLRenderer();
var aspectRatio = 1080 / 1920;
var width = Math.max(window.innerWidth, window.innerHeight / aspectRatio);
renderer.setSize(width, width * aspectRatio);
document.body.appendChild(renderer.domElement);


// load textures

function loadVideoTexture(id, src) {
  let video = document.getElementById(id);
  if (video == null) {
    video = document.createElement("video");
    video.id = id;
    video.type = 'video/webm';
    video.style.display = 'none';
    document.body.appendChild(video);
  }
  video.src = src;
  return new Promise((resolve, reject) => {
    video.oncanplay = function () {
      const canvas = [...document.getElementsByTagName('canvas')][0];
      canvas.style.top = `calc(min(0px, 50vh - 50vw * ${video.videoHeight} / ${video.videoWidth}))`;
      canvas.style.left = `calc(min(0px, 50vw - 50vh / ${video.videoHeight} / ${video.videoWidth}))`;
      resolve(new THREE.VideoTexture(video));
    };
    video.onerror = function () {
      video.remove();
      reject(new Error("Video source not loaded"));
    };
  });
}

async function loadPngTexture(src) {
  var textureLoader = new THREE.TextureLoader();
  return await textureLoader.loadAsync(src);
}

var texture1 = null;
var texture2 = null;
var sensitivity = 1.0;
// this must be done before running anything asynchronously
window.wallpaperPropertyListener = {
  applyUserProperties: function (properties) {
    window.info('Load properties: ' + Object.entries(properties).filter(e => e[1].value).map(e => e[0] + '=' + e[1].value));
    if (properties.video && properties.video.value.length > 0) {
      document.getElementById('video')?.remove();
      const file = 'file:///' + properties.video.value;
      window.info('Loading ' + file);
      loadVideoTexture('video', file)
        .catch(
          () => {
            if (properties.image && properties.image.value.length > 0) return Promise.reject();
            window.info("'" + file + "' fail to load, load 'video.webm' instead.");
            return loadVideoTexture('video', 'video.webm')
          }
        )
        .then(t => {
          window.info("Video loaded.");
          if (document.getElementById('cover') == null) mediaPlay();
          texture1 = t;
          shaderPass.uniforms.tImage.value = texture1;
        });
    }

    if (properties.videodepth && properties.videodepth.value.length > 0) {
      document.getElementById('videoDepth')?.remove();
      const file = 'file:///' + properties.videodepth.value;
      window.info('Loading depth video: ' + file);
      loadVideoTexture('videoDepth', file)
        .catch(
          () => {
            window.info("'" + file + "' fail to load, load 'videoDepth.webm' instead.");
            return loadVideoTexture('videoDepth', 'videoDepth.webm');
          }
        )
        .then(t => {
          window.info("Depth video loaded.");
          if (document.getElementById('cover') == null) mediaPlay();
          texture2 = t;
          shaderPass.uniforms.tDepth.value = texture2;
        });
    }

    if (properties.image && properties.image.value.length > 0) {
      document.getElementById('video')?.remove();
      const file = 'file:///' + properties.image.value;
      window.info('Loading image: ' + file);
      loadPngTexture(file)
        .catch(
          () => {
            window.info("'" + file + "' fail to load, load 'image.png' instead.");
            return loadPngTexture('image.png');
          }
        )
        .then(t => {
          window.info("Image loaded.");
          if (document.getElementById('cover') == null) mediaPlay();
          texture1 = t;
          shaderPass.uniforms.tImage.value = texture1;
        });
    }

    if (properties.imagedepth && properties.imagedepth.value.length > 0) {
      document.getElementById('videoDepth')?.remove();
      const file = 'file:///' + properties.imagedepth.value;
      window.info('Loading depth image: ' + file);
      loadPngTexture(file)
        .catch(
          () => {
            window.info("'" + file + "' fail to load, load 'imageDepth.png' instead.");
            return loadPngTexture('imageDepth.png');
          }
        )
        .then(t => {
          window.info("Depth image loaded.");
          if (document.getElementById('cover') == null) mediaPlay();
          texture2 = t;
          shaderPass.uniforms.tDepth.value = texture2;
        });
    }

    if (properties.test) {
      window.info(properties.test.value);
    }

    if (properties.sensitivity) {
      sensitivity = properties.sensitivity.value;
    }
  },
};

const IS_IN_BROWSER = true;
if (IS_IN_BROWSER) {
  try {
    texture1 = await loadVideoTexture('video', 'video.webm');
  } catch {
    texture1 = await loadPngTexture('image.png');
  }

  try {
    texture2 = await loadVideoTexture('videoDepth', 'videoDepth.webm');
  } catch {
    texture2 = await loadPngTexture('imageDepth.png');
  }
}


// media control

function mediaPlay() {
  var media = document.querySelectorAll("video, audio");
  for (var i = 0; i < media.length; i++) {
    var m = media[i];
    m.pause();
    m.currentTime = 0;
    m.play();
    m.onended = () => { mediaPlay(); };
  }
}

// function loadAudio(src) {
//   let audio = [...document.getElementsByClassName('audio')][0];
//   if (audio == null) {
//     audio = document.createElement("audio");
//     audio.style.display = 'none';
//     document.body.appendChild(audio);
//   }
//   audio.src = src;
//   audio.onerror = function () { audio.remove() };
// }
// loadAudio('audio.mp3');


// Set up post processing

var composer = new EffectComposer(renderer);

var renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

var shaderPass = new ShaderPass({
  uniforms: {
    tImage: { value: texture1 },
    tDepth: { value: texture2 },
    mouse: { value: new THREE.Vector2() }
  },
  vertexShader: `
        varying vec2 vUv;
        varying vec4 vPos;
        void main() {
            vUv = uv;
            vPos = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * vPos;
        }
    `,
  fragmentShader: `// http://panrafal.github.com/depthy
    precision mediump float;
    
    varying vec2 vUv;
    varying vec4 vPos;
    uniform sampler2D tDepth;
    uniform sampler2D tImage;
    uniform vec2 mouse;
    
    
    #define METHOD 1
    #define CORRECT
    #define ENLARGE 1.5
    #define ANTIALIAS 1
    #define AA_TRIGGER 0.8
    #define AA_POWER 1.0
    #define AA_MAXITER 8.0
    #define MAXSTEPS 16.0
    #define CONFIDENCE_MAX 2.5
    
    #define BRANCHLOOP  
    #define BRANCHSAMPLE 
    #define DEBUG 0
    
    #define PERSPECTIVE 0.0
    #define UPSCALE 1.06
    #define COMPRESSION 0.8
    
    const float perspective = PERSPECTIVE;
    const float upscale = UPSCALE;
    float steps = MAXSTEPS;
    
    float maskPower = MAXSTEPS * 1.0;
    float correctPower = 1.0;
    
    const float compression = COMPRESSION;
    const float dmin = (1.0 - compression) / 2.0;
    const float dmax = (1.0 + compression) / 2.0;
    
    const float vectorCutoff = 0.0 + dmin - 0.0001;
    
    void main(void) {

      vec2 pos = vec2(vUv[0] - 0.5, 0.5 - vUv[1]) / vec2(upscale) + vec2(0.5);

      //                             [focus]                       [scale up]
      mat2 vector = mat2(vec2((0.5 - 0.99) * mouse - mouse/2.0) * vec2(1.5, -1.5), 
                             vec2((0.5 - 0.015) * mouse + mouse/2.0) * vec2(1.5, -1.5));
                             
      // perspective shift
      vector[1] += (vec2(2.0) * pos - vec2(1.0)) * vec2(perspective);
      
      float dstep = compression / (steps - 1.0);
      vec2 vstep = (vector[1] - vector[0]) / vec2((steps - 1.0)) ;
      
      vec2 posSum = vec2(0.0);
    
      float confidenceSum = 0.0;
      float minConfidence = dstep / 2.0;
      
      float j = 0.0;
    
      for(float i = 0.0; i < MAXSTEPS; ++i) {
        vec2 vpos = pos + vector[1] - j * vstep;
        float dpos = 0.5 + compression / 2.0 - j * dstep;
        if (dpos >= vectorCutoff && confidenceSum < CONFIDENCE_MAX) {
          float depth = 1.0 - texture2D(tDepth, vpos * vec2(1, -1) + vec2(0, 1)).r;
          depth = clamp(depth, dmin, dmax);
          float confidence;
    
          confidence = step(dpos, depth + 0.001);
    
          if (confidence > AA_TRIGGER && i == j) {
            j -= 0.5;
          } else {
            j += 1.0;
          }
    
          if (confidence > 0.0) {
            #define CORRECTION_MATH
            posSum += (vpos + (vec2((depth - dpos) / (dstep * correctPower)) * vstep)) * confidence;    
            confidenceSum += confidence;
          }
        }
      };

      vec2 posYFlip = posSum / confidenceSum;
      gl_FragColor = texture2D(tImage, vec2(posYFlip[0], 1.0 - posYFlip[1]));
    }
    `
});
shaderPass.renderToScreen = true; // make this pass the final output
composer.addPass(shaderPass);


// Create a plane geometry and material and add it to the scene

var geometry = new THREE.PlaneGeometry(2, 2);
var material = new THREE.MeshBasicMaterial({ color: 0xffffff });
var plane = new THREE.Mesh(geometry, material);
scene.add(plane);


// Add an event listener for mouse move

var mouseX = 0, mouseY = 0;
window.addEventListener('mousemove', function (event) {
  // normalize the mouse position from -0.5 to 0.5
  mouseX = (event.clientX / window.innerWidth) - 0.5;
  mouseY = 0.5 - (event.clientY / window.innerHeight);
});


// Animate the scene

let clock = new THREE.Clock();
let frameDelta = 0, frameInterval = 1 / 30;
let x = mouseX, y = mouseY;

function animate() {
  requestAnimationFrame(animate);
  const clockDelta = clock.getDelta();
  frameDelta += clockDelta;
  if (frameDelta > frameInterval) {
    const k = sensitivity;
    x = mouseX * 0.1 * k + x * (1 - 0.1 * k), y = mouseY * 0.1 * k + y * (1 - 0.1 * k);
    shaderPass.uniforms.mouse.value.set((x * 0.015 * k).clamp(-0.008 * k, 0.008 * k), (y * 0.015 * k).clamp(-0.008 * k, 0.008 * k));
    composer.render();
    frameDelta = 0;
  }
}


// Listen to first click event

var firstClickHandler = function () {
  mediaPlay();
  animate();
  this.remove();
  console.log(texture1, texture2);
}

document.getElementById('cover').addEventListener("click", firstClickHandler);