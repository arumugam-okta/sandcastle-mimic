"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FileIcon } from "@/components/file-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TreeNode } from "@/lib/files";

function Node({ node, depth, active, onOpen }: {
  node: TreeNode; depth: number; active: string; onOpen: (p: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const pad = { paddingLeft: 8 + depth * 12 };
  if (node.children) {
    return (
      <>
        <Button variant="ghost" size="sm" className="w-full justify-start rounded-none font-normal" style={pad} onClick={() => setOpen(!open)}>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          <FileIcon name={node.name} folder open={open} /> {node.name}
        </Button>
        {open && node.children.map((c) => (
          <Node key={c.path} node={c} depth={depth + 1} active={active} onOpen={onOpen} />
        ))}
      </>
    );
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("w-full justify-start rounded-none font-normal", active === node.path && "bg-accent")}
      style={{ paddingLeft: pad.paddingLeft + 18 }}
      onClick={() => onOpen(node.path)}
    >
      <FileIcon name={node.name} /> {node.name}
    </Button>
  );
}

export function FileTree({ nodes, active, onOpen }: {
  nodes: TreeNode[]; active: string; onOpen: (p: string) => void;
}) {
  return (
    <div>
      {nodes.map((n) => <Node key={n.path} node={n} depth={0} active={active} onOpen={onOpen} />)}
    </div>
  );
}
