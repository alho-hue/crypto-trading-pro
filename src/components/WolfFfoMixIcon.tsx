import React from "react";

interface WolfFfoMixIconProps {
  size?: number;
  rounded?: boolean;
  className?: string;
}

const WolfFfoMixIcon: React.FC<WolfFfoMixIconProps> = ({ 
  size = 120, 
  rounded = true,
  className = ""
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      className={className}
    >
      <img
        src="/wolf-ffomix.png"
        alt="Wolf & FfoMix Logo"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: rounded ? "20px" : "0",
          boxShadow: rounded ? "0 4px 15px rgba(0,0,0,0.3)" : "none",
        }}
      />
    </div>
  );
};

export default WolfFfoMixIcon;
