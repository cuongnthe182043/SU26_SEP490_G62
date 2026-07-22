import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// Ngôi sao 4 cánh lấp lánh kiểu Gemini.
// gradient=true → tô gradient xanh→tím→hồng; ngược lại tô 1 màu (dùng trên nền màu).
type Props = { size?: number; gradient?: boolean; color?: string };

const PATH = 'M12 1 Q12.6 9.4 23 12 Q12.6 14.6 12 23 Q11.4 14.6 1 12 Q11.4 9.4 12 1 Z';

let uid = 0;

export function GeminiSpark({ size = 22, gradient = true, color = '#fff' }: Props) {
    const id = `gemini-spark-${(uid += 1)}`;
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            {gradient && (
                <Defs>
                    <LinearGradient id={id} x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                        <Stop offset="0" stopColor="#1BA1E3" />
                        <Stop offset="0.45" stopColor="#5C7CFA" />
                        <Stop offset="0.75" stopColor="#9B72CB" />
                        <Stop offset="1" stopColor="#D96570" />
                    </LinearGradient>
                </Defs>
            )}
            <Path d={PATH} fill={gradient ? `url(#${id})` : color} />
        </Svg>
    );
}
