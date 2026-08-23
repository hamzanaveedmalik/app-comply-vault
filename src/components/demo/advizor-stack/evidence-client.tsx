"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "~/lib/toast";
import { FileText, Play, ScanText } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { DEMO_BASE_PATH } from "./demo-data";

const DECISION_OPTIONS = [
  { value: "confirm", label: "Confirm issue" },
  { value: "addressed", label: "Adequately addressed" },
  { value: "escalate", label: "Escalate" },
] as const;

const decisionSchema = z.object({
  decision: z.enum(["confirm", "addressed", "escalate"]),
  rationale: z
    .string()
    .trim()
    .min(1, { message: "A reviewer rationale is required." }),
});

type DecisionFormValues = z.infer<typeof decisionSchema>;

export function EvidenceActions({ startTime }: { startTime: string }) {
  const notInDemo = () =>
    toast("Available in the full product", {
      description: "Playback and transcript navigation are disabled in this demo.",
    });

  return (
    <div className="flex flex-col gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-start text-xs"
        onClick={notInDemo}
      >
        <Play className="h-3.5 w-3.5" />
        Play from {startTime}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-start text-xs"
        onClick={notInDemo}
      >
        <ScanText className="h-3.5 w-3.5" />
        View surrounding context
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-start text-xs"
        onClick={notInDemo}
      >
        <FileText className="h-3.5 w-3.5" />
        Open full transcript
      </Button>
    </div>
  );
}

export function DecisionForm() {
  const router = useRouter();
  const form = useForm<DecisionFormValues>({
    resolver: zodResolver(decisionSchema),
    defaultValues: { decision: "confirm", rationale: "" },
  });

  const onSubmit = (_values: DecisionFormValues) => {
    toast.success("Review finalized. Evidence record preserved.");
    router.push(DEMO_BASE_PATH);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="decision"
          render={({ field }) => (
            <FormItem className="gap-2">
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="gap-1.5"
              >
                {DECISION_OPTIONS.map((option) => {
                  const active = field.value === option.value;
                  return (
                    <Label
                      key={option.value}
                      htmlFor={`decision-${option.value}`}
                      className={cn(
                        "flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-[13px] font-normal transition-colors",
                        active
                          ? "border-brand bg-brand-light"
                          : "hover:bg-surface-hover",
                      )}
                    >
                      <RadioGroupItem
                        id={`decision-${option.value}`}
                        value={option.value}
                      />
                      {option.label}
                    </Label>
                  );
                })}
              </RadioGroup>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="rationale"
          render={({ field }) => (
            <FormItem className="gap-1.5">
              <FormLabel className="text-xs text-text-muted">
                Reviewer rationale
              </FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  placeholder="Note what you reviewed and why you reached this decision"
                  className="resize-none text-[13px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-brand hover:bg-brand-dark"
          disabled={form.formState.isSubmitting}
        >
          Finalize review
        </Button>
      </form>
    </Form>
  );
}
