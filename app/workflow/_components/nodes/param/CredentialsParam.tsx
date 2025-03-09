// "use client";

// import { ParamProps } from "@/types/appNode";
// import React, { useId } from "react";
// import {
//   Select,
//   SelectContent,
//   SelectGroup,
//   SelectItem,
//   SelectLabel,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// import { Label } from "@/components/ui/label";
// import { useQuery } from "@tanstack/react-query";
// import { GetCredentialsForUser } from "@/actions/credentials/getCredentialsForUser";

// export default function CredentialsParam({
//   param,
//   updateNodeParamValue,
//   value,
// }: ParamProps) {
//   const id = useId();
//   const query = useQuery({
//     queryKey: ["credentials-for-user"],
//     queryFn: () => GetCredentialsForUser(),
//     refetchInterval: 10000, // 10s
//   });
//   return (
//     <div className="flex flex-col gap-1 w-full">
//       <Label htmlFor={id} className="text-xs flex">
//         {param.name}
//         {param.required && <p className="text-red-400 px-2">*</p>}
//       </Label>
//       <Select
//         onValueChange={(value) => updateNodeParamValue(value)}
//         defaultValue={value}
//       >
//         <SelectTrigger className="w-full">
//           <SelectValue placeholder="Select an option" />
//         </SelectTrigger>
//         <SelectContent>
//           <SelectGroup>
//             <SelectLabel>Credentials</SelectLabel>
//             {query.data?.map((credential) => (
//               <SelectItem key={credential.id} value={credential.id}>
//                 {credential.name}
//               </SelectItem>
//             ))}
//           </SelectGroup>
//         </SelectContent>
//       </Select>
//     </div>
//   );
// }
"use client";

import { ParamProps } from "@/types/appNode";
import React, { useId, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CredentialsParam({
  param,
  updateNodeParamValue,
  value,
}: ParamProps) {
  const id = useId();
  const [showCredential, setShowCredential] = useState(false);
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateNodeParamValue(e.target.value);
  };

  // Toggle visibility
  const toggleVisibility = () => {
    setShowCredential(!showCredential);
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <Label htmlFor={id} className="text-xs flex">
        {param.name}
        {param.required && <p className="text-red-400 px-2">*</p>}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={showCredential ? "text" : "password"}
          placeholder={`Enter your ${param.name} here...`}
          value={value || ""}
          onChange={handleInputChange}
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full"
          onClick={toggleVisibility}
          aria-label={showCredential ? "Hide credential" : "Show credential"}
        >
          {showCredential ? (
            <EyeOffIcon className="h-4 w-4" />
          ) : (
            <EyeIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Paste your {param.name} directly. This value will be securely stored.
      </p>
    </div>
  );
}