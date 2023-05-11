import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';


// Create a scene, camera and renderer
var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
var renderer = new THREE.WebGLRenderer();
var size = Math.max(window.innerHeight, window.innerWidth);
var aspectRatio = 1;
renderer.setSize(size, size * aspectRatio);
document.body.appendChild(renderer.domElement);

// Load the png textures using a TextureLoader
var textureLoader = new THREE.TextureLoader();
// var texture1 = await textureLoader.loadAsync('noise.png');  // debug
// var texture1 = await textureLoader.loadAsync('image.png');
// var texture2 = await textureLoader.loadAsync('depth.png');

const video = document.getElementById( 'video' );
const texture1 = new THREE.VideoTexture( video );

const videoDepth = document.getElementById( 'videoDepth' );
const texture2 = new THREE.VideoTexture( videoDepth );

// Create a composer for post processing
var composer = new EffectComposer(renderer);

// Create a render pass and add it to the composer
var renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Create a shader pass with a custom shader and add it to the composer
var shaderPass = new ShaderPass({
    uniforms: {
        tImage: {value: texture1},
        tDepth: {value: texture2},
        mouse: {value: new THREE.Vector2()}
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
      mat2 vector = mat2(vec2((0.5 - 0.5) * mouse - mouse/2.0) * vec2(1.5, -1.5), 
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
var material = new THREE.MeshBasicMaterial({color: 0xffffff});
var plane = new THREE.Mesh(geometry, material);
scene.add(plane);

// Add an event listener for mouse move
window.addEventListener('mousemove', function(event) {
    // normalize the mouse position from -0.5 to 0.5
    var x = (event.clientX / window.innerWidth) - 0.5;
    var y = 0.5 - (event.clientY / window.innerHeight);

    x *= 0.05; y *= 0.05;

    const limit = 0.01
    if (x > limit) x = limit;
    else if (x < -limit) x = -limit;
    if (y > limit) y = limit;
    else if (y < -limit) y = -limit;

    // update the shader uniform
    shaderPass.uniforms.mouse.value.set(x, y);
});

// Animate the scene
let clock = new THREE.Clock();
let delta = 0;
// 30 fps
let interval = 1 / 30;
function animate() {
    requestAnimationFrame(animate);
    delta += clock.getDelta();
    if (delta  < interval) return;
    composer.render();
}

var handlerFirstClick = function() {
    var click = 0;
    return function() {
        if(click === 0) {
            video.play();
            videoDepth.play();
            animate();
        }
        click++;
    }
}();

document.body.addEventListener("click", handlerFirstClick);