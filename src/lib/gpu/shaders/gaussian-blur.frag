uniform sampler2D tDepth;
uniform vec2 uDirection;
uniform float uSigma;

varying vec2 vUv;

const int MAX_RADIUS = 15;

void main() {
    int radius = int(ceil(uSigma * 3.0));
    float s2 = 2.0 * uSigma * uSigma;

    float sum = 0.0;
    float wSum = 0.0;

    for (int i = -MAX_RADIUS; i <= MAX_RADIUS; i++) {
        if (i < -radius || i > radius) continue;

        float x = float(i);
        float w = exp(-(x * x) / s2);
        sum += texture2D(tDepth, vUv + uDirection * x).r * w;
        wSum += w;
    }

    gl_FragColor = vec4(vec3(sum / wSum), 1.0);
}
