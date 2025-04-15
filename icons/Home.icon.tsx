import React from "react";
import Svg, { Path } from "react-native-svg";

export const HomeIcon = () => {
  return (
    <>
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <Path
          d="M6.133 21C4.955 21 4 20.02 4 18.81V10.008C4 9.343 4.295 8.713 4.8 8.298L10.667 3.48C11.0419 3.16958 11.5133 2.99973 12 2.99973C12.4867 2.99973 12.9581 3.16958 13.333 3.48L19.199 8.298C19.705 8.713 20 9.343 20 10.008V18.81C20 20.02 19.045 21 17.867 21H6.133Z"
          stroke="white"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <Path
          d="M9.5 21V15.5C9.5 14.9696 9.71071 14.4609 10.0858 14.0858C10.4609 13.7107 10.9696 13.5 11.5 13.5H12.5C13.0304 13.5 13.5391 13.7107 13.9142 14.0858C14.2893 14.4609 14.5 14.9696 14.5 15.5V21"
          stroke="white"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </Svg>
    </>
  );
};
