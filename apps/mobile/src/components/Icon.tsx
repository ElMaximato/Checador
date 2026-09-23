import Svg, { Path, Circle, Rect, G } from "react-native-svg";

// Mismos paths que src/App.tsx del proyecto Figma Make original,
// para preservar el set de íconos exacto del diseño.

export type IconName =
  | "shield"
  | "fingerprint"
  | "clock"
  | "home"
  | "calendar"
  | "user"
  | "bell"
  | "map"
  | "camera"
  | "check"
  | "chevron"
  | "id"
  | "building"
  | "logout"
  | "lock";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 22, color = "currentColor" }: Props) {
  const stroke = color === "currentColor" ? "#14213d" : color;

  const body: Record<IconName, JSX.Element> = {
    shield: (
      <>
        <Path d="M12 3 5 6v5c0 4.5 2.8 8.1 7 10 4.2-1.9 7-5.5 7-10V6l-7-3Z" />
        <Path d="m9.5 12 1.6 1.6 3.7-4" />
      </>
    ),
    fingerprint: (
      <>
        <Path d="M12 11a2 2 0 0 1 2 2c0 3-.8 5.5-2.3 7.5" />
        <Path d="M8.8 20c1.2-1.8 1.7-4.2 1.7-7a1.5 1.5 0 0 1 3 0c0 1.8-.2 3.5-.8 5" />
        <Path d="M6.1 18.5A13 13 0 0 0 7.5 13a4.5 4.5 0 0 1 9 0c0 2.5-.4 4.8-1.4 7" />
        <Path d="M4.5 15.5c.3-.8.5-1.7.5-2.5a7 7 0 0 1 13.7-2" />
        <Path d="M6.2 8A7 7 0 0 1 17 6.8" />
      </>
    ),
    clock: (
      <>
        <Circle cx="12" cy="12" r="9" />
        <Path d="M12 7v5l3 2" />
      </>
    ),
    home: (
      <>
        <Path d="m4 10 8-7 8 7" />
        <Path d="M6 9v11h12V9M10 20v-6h4v6" />
      </>
    ),
    calendar: (
      <>
        <Rect x="3" y="5" width="18" height="16" rx="3" />
        <Path d="M8 3v4M16 3v4M3 10h18" />
      </>
    ),
    user: (
      <>
        <Circle cx="12" cy="8" r="4" />
        <Path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
    bell: (
      <>
        <Path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8" />
        <Path d="M10 21h4" />
      </>
    ),
    map: (
      <>
        <Path d="M20 10c0 4.5-8 11-8 11S4 14.5 4 10a8 8 0 1 1 16 0Z" />
        <Circle cx="12" cy="10" r="2.5" />
      </>
    ),
    camera: (
      <>
        <Path d="M8 6.5 9.5 4h5L16 6.5h3a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h3Z" />
        <Circle cx="12" cy="13" r="4" />
      </>
    ),
    check: <Path d="m5 12 4.2 4.2L19 6.5" />,
    chevron: <Path d="m9 18 6-6-6-6" />,
    id: (
      <>
        <Rect x="3" y="5" width="18" height="14" rx="2.5" />
        <Circle cx="8.5" cy="11" r="2.2" />
        <Path d="M5.5 16c.5-1.5 1.5-2.2 3-2.2s2.5.7 3 2.2M14 10h4M14 14h4" />
      </>
    ),
    building: (
      <>
        <Path d="M5 21V4h10v17M15 9h4v12M3 21h18" />
        <Path d="M8 8h4M8 12h4M8 16h4" />
      </>
    ),
    logout: <Path d="M10 5H5v14h5M14 16l4-4-4-4M18 12H9" />,
    lock: (
      <>
        <Rect x="4" y="10" width="16" height="11" rx="3" />
        <Path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {body[name]}
      </G>
    </Svg>
  );
}
