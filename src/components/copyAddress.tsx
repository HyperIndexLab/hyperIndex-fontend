import { useState } from "react";
import { useToast } from "./ToastContext";


export default function CopyAddress({
  address,
  headLength = 6,
  tailLength = 4,
}: {
  address: `0x${string}`;
  headLength?: number;
  tailLength?: number;
}) {
  const [, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      type: 'success',
      message: 'Copied Success'
    });
  };

  const truncateAddress = (
    address: string,
    headLength: number,
    tailLength: number
  ) => {
    if (address.length <= headLength + tailLength) {
      return address;
    }
    const head = address.slice(0, headLength);
    const tail = address.slice(-tailLength);
    return `${head}...${tail}`;
  };

  return (
    <div
      className="relative cursor-pointer flex items-center gap-2"
      onClick={handleCopy}
    >
      <p className="hover:text-primary text-sm">
        {truncateAddress(address, headLength, tailLength)}
      </p>
      <button className="hover:text-primary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
        >
          <path
            d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}
