uniform sampler2D tDepth;
uniform bool uInvert;
uniform float uContrast;
uniform float uBrightness;

varying vec2 vUv;

void main() {
    float depth = texture2D(tDepth, vUv).r;

    if (uInvert) depth = 1.0 - depth;

    depth = (depth - 0.5) * uContrast + 0.5 + uBrightness;
    depth = clamp(depth, 0.0, 1.0);

    gl_FragColor = vec4(vec3(depth), 1.0);
}
