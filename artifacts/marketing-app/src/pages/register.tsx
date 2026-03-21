import React from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Megaphone, Sun, Moon } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme-context";

const registerSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Please enter a valid email"),
  organizationName: z.string().min(2, "Organization name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Register() {
  const { toast } = useToast();
  const registerMutation = useRegister();
  const { resolvedTheme, setTheme } = useTheme();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", organizationName: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    registerMutation.mutate({ data }, {
      onSuccess: () => {
        window.location.href = "/";
      },
      onError: (error: any) => {
        toast({
          title: "Registration Failed",
          description: error.data?.error || "An error occurred",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="min-h-screen w-full flex bg-background">
      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 relative">
        <button
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="absolute top-6 right-6 p-2 rounded-xl text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {resolvedTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <motion.div 
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          className="mx-auto w-full max-w-sm lg:w-96"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl saturn-gradient flex items-center justify-center shadow-lg">
              <Megaphone className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-2xl tracking-tight saturn-gradient-text">Saturn</span>
          </div>

          <h2 className="mt-8 text-3xl font-display font-bold tracking-tight text-foreground">
            Create an account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Start managing your marketing campaigns today.
          </p>

          <div className="mt-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Doe" className="h-11 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input placeholder="name@company.com" className="h-11 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="organizationName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Corp" className="h-11 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="" className="h-11 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-12 mt-2 rounded-xl saturn-gradient text-white text-base font-semibold shadow-lg transition-all hover:opacity-90"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign up"}
                </Button>
              </form>
            </Form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
      <div className="hidden lg:block relative w-0 flex-1 overflow-hidden">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={`${import.meta.env.BASE_URL}images/saturn-bg.jpg`}
          alt="Saturn rings in space"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center px-12"
          >
            <div className="w-20 h-20 rounded-2xl saturn-gradient flex items-center justify-center shadow-2xl mx-auto mb-8 backdrop-blur-sm bg-opacity-90">
              <Megaphone className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-4xl font-display font-bold text-white mb-4 drop-shadow-lg">
              Marketing Command Center
            </h2>
            <p className="text-lg text-white/80 max-w-md drop-shadow-md">
              Generate AI-powered social media content at scale. Manage campaigns. Export to SocialPilot.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
