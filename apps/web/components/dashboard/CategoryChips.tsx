"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight, Laptop, ShoppingBag, Leaf, Cog, Package, Utensils, Sparkles, Grid3X3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CATEGORIES: Category[] = [
  { id: "all", name: "All", icon: Grid3X3 },
  { id: "Electronics", name: "Electronics", icon: Laptop },
  { id: "Fashion", name: "Fashion", icon: ShoppingBag },
  { id: "Agriculture", name: "Agriculture", icon: Leaf },
  { id: "Machinery", name: "Machinery", icon: Cog },
  { id: "Raw Materials", name: "Raw Materials", icon: Package },
  { id: "Food & Beverages", name: "Food & Beverages", icon: Utensils },
  { id: "Health & Beauty", name: "Health & Beauty", icon: Sparkles },
];

interface CategoryChipsProps {
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export function CategoryChips({ selectedCategory, onCategoryChange }: CategoryChipsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative group">
      {/* Left scroll button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-background"
        onClick={() => scroll("left")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {/* Categories container */}
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-2 scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {CATEGORIES.map((category) => {
          const Icon = category.icon;
          const isSelected = selectedCategory === category.id;

          return (
            <button
              key={category.id}
              onClick={() => onCategoryChange(category.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border whitespace-nowrap transition-all duration-200 shrink-0",
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-md"
                  : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          );
        })}
      </div>

      {/* Right scroll button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity bg-background"
        onClick={() => scroll("right")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
