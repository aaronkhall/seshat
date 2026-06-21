// One entry in the active layer stack. The stack is ordered top -> bottom:
// index 0 is the topmost layer (drawn last / on top on the map).
export interface ActiveLayer {
  defId: string;
  opacity: number; // 0..1
  visible: boolean;
}
