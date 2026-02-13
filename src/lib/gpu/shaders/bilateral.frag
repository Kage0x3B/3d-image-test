uniform sampler2D tDepth;
uniform float uSpatialSigma;
uniform float uRangeSigma;
uniform vec2 uTexelSize;

varying vec2 vUv;

const int MAX_RADIUS = 10;

void main() {
    float centerVal = texture2D(tDepth, vUv).r;
    int radius = int(ceil(uSpatialSigma * 2.0));
    float spatialS2 = 2.0 * uSpatialSigma * uSpatialSigma;
    float rangeS2 = 2.0 * uRangeSigma * uRangeSigma;

    float sum = 0.0;
    float wSum = 0.0;

    for (int dy = -MAX_RADIUS; dy <= MAX_RADIUS; dy++) {
        if (dy < -radius || dy > radius) continue;

        float fy = float(dy);
        float spatialY = exp(-(fy * fy) / spatialS2);

        for (int dx = -MAX_RADIUS; dx <= MAX_RADIUS; dx++) {
            if (dx < -radius || dx > radius) continue;

            float fx = float(dx);
            float spatialX = exp(-(fx * fx) / spatialS2);

            vec2 offset = vec2(fx, fy) * uTexelSize;
            float val = texture2D(tDepth, vUv + offset).r;
            float diff = val - centerVal;
            float rangeW = exp(-(diff * diff) / rangeS2);

            float w = spatialX * spatialY * rangeW;
            sum += val * w;
            wSum += w;
        }
    }

    gl_FragColor = vec4(vec3(sum / wSum), 1.0);
}
