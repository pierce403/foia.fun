import { isReadOnly } from "@/lib/maintenance";
import FoiaBoard from "@/components/foia-board";

export default function Home() {
  return <FoiaBoard readOnly={isReadOnly()} />;
}
