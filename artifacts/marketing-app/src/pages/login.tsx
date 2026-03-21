import React from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLogin } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sun, Moon } from "lucide-react";
import { SynozurLogo } from "@/components/synozur-logo";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/theme-context";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const { toast } = useToast();
  const loginMutation = useLogin();
  const { resolvedTheme, setTheme } = useTheme();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data }, {
      onSuccess: () => {
        window.location.href = "/";
      },
      onError: (error: any) => {
        toast({
          title: "Login Failed",
          description: error.data?.error || "Invalid credentials",
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
            <SynozurLogo className="w-10 h-10" />
            <span className="font-display font-bold text-3xl saturn-gradient-text">Saturn</span>
          </div>

          <h2 className="mt-8 text-3xl font-display font-bold tracking-tight text-foreground">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Please sign in to your account
          </p>

          <div className="mt-10">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email address</FormLabel>
                      <FormControl>
                        <Input placeholder="name@company.com" className="h-12 rounded-xl" {...field} />
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
                        <Input type="password" placeholder="" className="h-12 rounded-xl" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-12 rounded-xl saturn-gradient text-white text-base font-semibold shadow-lg transition-all hover:opacity-90"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign in"}
                </Button>
              </form>
            </Form>

            <p className="mt-8 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="font-semibold text-primary hover:text-primary/80 transition-colors">
                Register here
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
            <div className="mx-auto mb-8">
              <SynozurLogo className="w-20 h-20" variant="white" />
            </div>
            <h2 className="text-4xl font-display font-bold text-white mb-4 drop-shadow-lg">
              Saturn
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
