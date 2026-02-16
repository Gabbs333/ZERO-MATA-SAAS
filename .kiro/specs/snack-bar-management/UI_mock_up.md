voici les maquetes : <!-- Manager Dashboard Overview -->

<!DOCTYPE html>

<html class="light" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Manager Dashboard - Le Bunker Bar</title>

<!-- Fonts -->

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Noto+Sans:wght@400;500;700&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<!-- Tailwind CSS -->

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Theme Config -->

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#141414",

                        "background-light": "#f7f7f7",

                        "background-dark": "#191919",

                        "semantic-green": "#039855",

                        "semantic-red": "#D92D20",

                        "semantic-amber": "#DC6803",

                    },

                    fontFamily: {

                        "display": ["Plus Jakarta Sans", "sans-serif"],

                        "body": ["Noto Sans", "sans-serif"],

                    },

                    borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "2xl": "1rem", "full": "9999px"},

                    boxShadow: {

                        'soft': '0 2px 8px -2px rgba(20, 20, 20, 0.05), 0 1px 4px -2px rgba(20, 20, 20, 0.02)',

                    }

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar for horizontal scrolling */

        .hide-scrollbar::-webkit-scrollbar {

            display: none;

        }

        .hide-scrollbar {

            -ms-overflow-style: none;

            scrollbar-width: none;

        }

        

        /* Chart animation simulation */

        @keyframes draw {

            to { stroke-dashoffset: 0; }

        }

        .animate-path {

            stroke-dasharray: 1000;

            stroke-dashoffset: 1000;

            animation: draw 2s ease-out forwards;

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display text-primary dark:text-white antialiased pb-24">

<!-- Top App Bar -->

<div class="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-800 transition-colors duration-300">

<div class="flex items-center justify-between p-4 pb-3">

<div class="flex items-center gap-3">

<div class="relative">

<div class="bg-center bg-no-repeat bg-cover rounded-full size-10 border border-neutral-200 dark:border-neutral-700 shadow-sm" data-alt="Manager profile picture showing a professional headshot" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBny76QuZgCYr4kDz-bFaIYIAE0Gyu5FHI3SoVU3qHTMKwS3ItyXxFhtcnxjNHLlWTqv5JfLdA04TTR2rYoDU0uoal_FrWPdCq8u0hSv621iViWL_vZcg9xgM5OMtpU4MNc2gmmevsgHaecK4ZmA-h3u70lDsiROuJSo9zf2tYFuDAUnr-mgO0HcoMts8Lw23KeP1QYI7xQeXLqroz9rqHoPtXA4k4C1uFJJLx-JpfnZLT5_PIQUqnmPL7_GZnOsC0SwfNk1vR5j30e");'>

</div>

<div class="absolute bottom-0 right-0 size-3 bg-semantic-green rounded-full border-2 border-white dark:border-[#191919]"></div>

</div>

<div class="flex flex-col">

<h2 class="text-sm font-semibold text-neutral-500 dark:text-neutral-400 leading-none mb-0.5">Manager Mode</h2>

<h1 class="text-primary dark:text-white text-base font-bold leading-none tracking-tight">Le Bunker Bar</h1>

</div>

</div>

<button class="relative flex items-center justify-center size-10 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">

<span class="material-symbols-outlined text-primary dark:text-white text-[24px]">notifications</span>

<span class="absolute top-2 right-2.5 size-2 bg-semantic-red rounded-full"></span>

</button>

</div>

</div>

<!-- Alert Banner -->

<div class="px-4 pt-4">

<div class="flex items-start gap-3 p-3 bg-semantic-amber/10 border border-semantic-amber/20 rounded-lg">

<span class="material-symbols-outlined text-semantic-amber text-[20px] mt-0.5">inventory_2</span>

<div class="flex-1">

<p class="text-xs font-bold text-semantic-amber uppercase tracking-wider mb-0.5">Stock Alert</p>

<p class="text-sm text-primary dark:text-neutral-200 font-medium leading-tight">Guinness Small is critically low (4 crates left).</p>

</div>

<button class="text-semantic-amber font-bold text-xs underline">Order</button>

</div>

</div>

<!-- HUD Stats Section -->

<div class="flex flex-col gap-4 p-4">

<!-- Main Comparison Row -->

<div class="grid grid-cols-2 gap-3">

<!-- Card 1: Daily CA -->

<div class="flex flex-col gap-1 rounded-xl p-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-soft">

<div class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400 mb-1">

<span class="material-symbols-outlined text-[18px]">point_of_sale</span>

<span class="text-xs font-bold uppercase tracking-wider">Daily CA</span>

</div>

<p class="text-primary dark:text-white text-xl font-bold tracking-tight">150 000</p>

<div class="flex items-center justify-between">

<span class="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium">XAF</span>

<span class="text-[10px] font-bold text-semantic-green bg-semantic-green/10 px-1.5 py-0.5 rounded-full">+5%</span>

</div>

</div>

<!-- Card 2: Real Collections (Theft Prevention Focus) -->

<div class="flex flex-col gap-1 rounded-xl p-4 bg-primary text-white border border-primary shadow-soft relative overflow-hidden">

<!-- Background Pattern -->

<div class="absolute -right-4 -top-4 size-20 bg-white/5 rounded-full blur-xl"></div>

<div class="flex items-center gap-1.5 text-white/70 mb-1 z-10">

<span class="material-symbols-outlined text-[18px]">payments</span>

<span class="text-xs font-bold uppercase tracking-wider">Collected</span>

</div>

<p class="text-white text-xl font-bold tracking-tight z-10">120 000</p>

<div class="flex items-center justify-between z-10">

<span class="text-[10px] text-white/50 font-medium">XAF (Cash)</span>

<span class="text-[10px] font-bold text-white bg-white/20 px-1.5 py-0.5 rounded-full">80%</span>

</div>

</div>

</div>

<!-- Secondary Row: Debt -->

<div class="flex items-center justify-between rounded-xl p-4 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-soft border-l-4 border-l-semantic-red">

<div class="flex flex-col">

<span class="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">Current Debt</span>

<div class="flex items-baseline gap-1">

<span class="text-2xl font-bold text-primary dark:text-white">30 000</span>

<span class="text-xs text-neutral-400">XAF</span>

</div>

</div>

<div class="flex flex-col items-end gap-1">

<span class="text-xs font-medium text-semantic-red">High Risk</span>

<button class="text-xs font-bold text-primary dark:text-white underline decoration-neutral-300 underline-offset-2">View Debtors</button>

</div>

</div>

</div>

<!-- Charts Section -->

<div class="border-t border-b border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-5">

<div class="px-4 mb-2 flex items-center justify-between">

<h3 class="text-primary dark:text-white text-base font-bold leading-tight">Sales Velocity</h3>

<span class="text-xs font-medium text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">Last 12h</span>

</div>

<div class="relative w-full h-[140px] px-2">

<!-- Chart Grid Lines -->

<div class="absolute inset-0 px-4 flex flex-col justify-between pointer-events-none opacity-30">

<div class="w-full h-px bg-neutral-200 dark:bg-neutral-700 border-dashed border-t"></div>

<div class="w-full h-px bg-neutral-200 dark:bg-neutral-700 border-dashed border-t"></div>

<div class="w-full h-px bg-neutral-200 dark:bg-neutral-700 border-dashed border-t"></div>

</div>

<svg class="w-full h-full overflow-visible" preserveaspectratio="none" viewbox="0 0 360 100">

<defs>

<lineargradient id="gradient" x1="0%" x2="0%" y1="0%" y2="100%">

<stop offset="0%" style="stop-color:#141414;stop-opacity:0.1"></stop> <!-- Primary color with low opacity -->

<stop offset="100%" style="stop-color:#141414;stop-opacity:0"></stop>

</lineargradient>

</defs>

<!-- Fill -->

<path class="dark:fill-white/5" d="M0,80 Q40,60 80,70 T160,50 T240,30 T320,40 T360,20 V100 H0 Z" fill="url(#gradient)"></path>

<!-- Line -->

<path class="text-primary dark:text-white animate-path" d="M0,80 Q40,60 80,70 T160,50 T240,30 T320,40 T360,20" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path>

<!-- Data Points -->

<circle class="fill-white stroke-primary dark:stroke-white stroke-2" cx="240" cy="30" r="3"></circle>

<circle class="fill-primary dark:fill-white" cx="360" cy="20" r="4"></circle>

</svg>

</div>

<!-- X-Axis Labels -->

<div class="flex justify-between px-4 mt-2 text-[11px] font-medium text-neutral-400">

<span>2PM</span>

<span>4PM</span>

<span>6PM</span>

<span>8PM</span>

<span>10PM</span>

<span>NOW</span>

</div>

</div>

<!-- Pending Validations Section -->

<div class="p-4">

<div class="flex items-center justify-between mb-3">

<h3 class="text-primary dark:text-white text-lg font-bold leading-tight tracking-tight">Pending Validations</h3>

<span class="flex items-center justify-center size-6 rounded-full bg-semantic-amber text-white text-xs font-bold">3</span>

</div>

<div class="flex flex-col gap-3">

<!-- Request Card 1 -->

<div class="group bg-white dark:bg-neutral-800 rounded-xl p-3.5 border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden">

<div class="absolute left-0 top-0 bottom-0 w-1 bg-semantic-red"></div>

<div class="flex justify-between items-start mb-3">

<div class="flex items-center gap-3">

<div class="bg-center bg-no-repeat bg-cover rounded-full size-10 border border-neutral-100" data-alt="Waitress Sarah profile picture" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCd1YHgxXvaAgZ9fO_EvsjJilssJiD8wpW3fwlEgJdEIkko0Faw0RzacHTdlhGvu66sevCrd4JNSMJvcKiiT1VzPNRmd1WAbqnMFYbMJMgunGmwZwN5cttvk7zk5QqkykDA-sd1AEPjRoWJ0dzN6yu7omSNJA2qV0w3JofcZyoNtcJwvJbQ21_PX8LBnWpkCqmMY_7rH6gcMihxbhAjeNDoEmXwWOU6cKn2lQKzyuQk62fxeXuxOEpQqIr_pjbyGiSmVwop63sOFnC6");'>

</div>

<div>

<p class="text-sm font-bold text-primary dark:text-white">Sarah M.</p>

<p class="text-xs text-neutral-500 font-medium">Waitress • Table 4</p>

</div>

</div>

<span class="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-semantic-red/10 text-semantic-red border border-semantic-red/20">

                        Void Item

                    </span>

</div>

<div class="pl-13 mb-4">

<p class="text-sm font-medium text-primary dark:text-white mb-0.5">Whiskey Black Label 12yo</p>

<p class="text-xs text-neutral-400">Reason: "Customer changed mind"</p>

</div>

<div class="flex gap-2 pl-1">

<button class="flex-1 h-10 rounded-lg border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-semibold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center justify-center gap-2">

<span class="material-symbols-outlined text-[18px]">close</span>

                        Deny

                    </button>

<button class="flex-1 h-10 rounded-lg bg-primary dark:bg-white text-white dark:text-primary font-bold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 flex items-center justify-center gap-2 shadow-sm">

<span class="material-symbols-outlined text-[18px]">check</span>

                        Approve

                    </button>

</div>

</div>

<!-- Request Card 2 -->

<div class="group bg-white dark:bg-neutral-800 rounded-xl p-3.5 border border-neutral-200 dark:border-neutral-700 shadow-sm relative overflow-hidden">

<div class="absolute left-0 top-0 bottom-0 w-1 bg-neutral-400"></div>

<div class="flex justify-between items-start mb-3">

<div class="flex items-center gap-3">

<div class="bg-center bg-no-repeat bg-cover rounded-full size-10 border border-neutral-100" data-alt="Waitress Marie profile picture" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCPL_JWg7VcntKHh_l0OBarUxLNNxN8KKISsiiLL76ZqTTNHSir2Hf-8APM38EaLruDQ5JKzW1kSUe-faHIvnjBuuZqjc_BsSg05TsVWOs2NcqiGyDrXOLLw3QWilxE3vJGa0ZZfgQO8mOgTdhwUVdOa5x_h1ZxVSPhB4-6XvfKMTRtolsbIyPqmFWPiD4SDmA_W3lYt_Z1tysM-zreH6zSPPVXgOoOK4e_qHXJLjm769kTuGiUQ0LsU8pliEaV-Yc0997JfndyENik");'>

</div>

<div>

<p class="text-sm font-bold text-primary dark:text-white">Marie K.</p>

<p class="text-xs text-neutral-500 font-medium">Waitress • Bar</p>

</div>

</div>

<span class="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600">

                        Bottle Return

                    </span>

</div>

<div class="pl-13 mb-4">

<p class="text-sm font-medium text-primary dark:text-white mb-0.5">Heineken 65cl (x2)</p>

<p class="text-xs text-neutral-400">To: Stock</p>

</div>

<div class="flex gap-2 pl-1">

<button class="flex-1 h-10 rounded-lg border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 font-semibold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center justify-center gap-2">

                        Deny

                    </button>

<button class="flex-1 h-10 rounded-lg bg-primary dark:bg-white text-white dark:text-primary font-bold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 flex items-center justify-center gap-2 shadow-sm">

                        Confirm

                    </button>

</div>

</div>

</div>

<div class="h-6"></div> <!-- Spacer -->

</div>

<!-- Bottom Navigation -->

<div class="fixed bottom-0 left-0 w-full bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 pb-safe pt-2 px-4 z-50">

<div class="flex justify-between items-end pb-3">

<button class="flex flex-col items-center gap-1 min-w-[60px] group">

<span class="material-symbols-outlined text-[26px] text-primary dark:text-white group-hover:scale-110 transition-transform">dashboard</span>

<span class="text-[10px] font-bold text-primary dark:text-white">Overview</span>

</button>

<button class="flex flex-col items-center gap-1 min-w-[60px] group">

<span class="material-symbols-outlined text-[26px] text-neutral-400 group-hover:text-primary dark:group-hover:text-white transition-colors">inventory_2</span>

<span class="text-[10px] font-medium text-neutral-400 group-hover:text-primary dark:group-hover:text-white transition-colors">Stock</span>

</button>

<!-- Floating Add Button for quick actions -->

<div class="-mt-8">

<button class="flex items-center justify-center size-14 rounded-full bg-primary dark:bg-white text-white dark:text-primary shadow-lg hover:scale-105 transition-transform">

<span class="material-symbols-outlined text-[32px]">add</span>

</button>

</div>

<button class="flex flex-col items-center gap-1 min-w-[60px] group">

<span class="material-symbols-outlined text-[26px] text-neutral-400 group-hover:text-primary dark:group-hover:text-white transition-colors">groups</span>

<span class="text-[10px] font-medium text-neutral-400 group-hover:text-primary dark:group-hover:text-white transition-colors">Staff</span>

</button>

<button class="flex flex-col items-center gap-1 min-w-[60px] group">

<span class="material-symbols-outlined text-[26px] text-neutral-400 group-hover:text-primary dark:group-hover:text-white transition-colors">settings</span>

<span class="text-[10px] font-medium text-neutral-400 group-hover:text-primary dark:group-hover:text-white transition-colors">Settings</span>

</button>

</div>

<!-- iOS Home Indicator simulation -->

<div class="w-full flex justify-center pb-2">

<div class="w-32 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full"></div>

</div>

</div>

</body></html>

<!-- Stock Inventory & History -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Stock Inventory &amp; History</title>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;family=Noto+Sans:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#2c576d",

                        "primary-dark": "#1f3e4f",

                        "accent": "#D39E3B",

                        "background-light": "#f6f7f7",

                        "background-dark": "#161519",

                        "surface-dark": "#2A2A2E",

                        "border-dark": "#3f515a",

                    },

                    fontFamily: {

                        "display": ["Space Grotesk", "sans-serif"],

                        "body": ["Noto Sans", "sans-serif"],

                    },

                    borderRadius: {

                        "DEFAULT": "0.125rem", // 2px

                        "sm": "0.25rem", // 4px

                        "lg": "0.5rem", // 8px

                        "full": "9999px",

                    },

                },

            },

        }

    </script>

<style>

        /* Custom Scrollbar for a cleaner look */

        ::-webkit-scrollbar {

            width: 4px;

        }

        ::-webkit-scrollbar-track {

            background: #161519; 

        }

        ::-webkit-scrollbar-thumb {

            background: #3f515a; 

            border-radius: 2px;

        }

        ::-webkit-scrollbar-thumb:hover {

            background: #2c576d; 

        }

        .text-accent {

            color: #D39E3B;

        }

        .bg-accent-subtle {

            background-color: rgba(211, 158, 59, 0.1);

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark min-h-screen font-display text-white selection:bg-primary selection:text-white overflow-x-hidden">

<div class="relative flex h-full w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark border-x border-white/5 min-h-screen">

<!-- Top App Bar -->

<header class="sticky top-0 z-20 flex items-center bg-background-dark/95 backdrop-blur-md px-5 py-4 justify-between border-b border-white/5">

<div class="flex items-center gap-3">

<!-- Search Icon -->

<button class="text-white/70 hover:text-white transition-colors p-1 rounded hover:bg-white/5">

<span class="material-symbols-outlined text-2xl">search</span>

</button>

</div>

<h1 class="text-white text-lg font-bold tracking-tight uppercase">Inventory</h1>

<div class="flex items-center gap-3">

<!-- Export Icon -->

<button class="text-white/70 hover:text-white transition-colors flex items-center gap-1 p-1 rounded hover:bg-white/5">

<span class="text-xs font-medium tracking-wide text-white/50">EXP</span>

<span class="material-symbols-outlined text-xl">download</span>

</button>

</div>

</header>

<!-- Main Content Area -->

<main class="flex-1 flex flex-col p-4 gap-6">

<!-- Segmented Control -->

<div class="w-full">

<div class="flex h-11 w-full items-center justify-center rounded-sm bg-surface-dark p-1 border border-white/5">

<label class="relative z-10 flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-sm transition-all duration-200 has-[:checked]:bg-primary has-[:checked]:text-white text-white/50 hover:text-white/80">

<span class="text-sm font-bold tracking-wide">Current Stock</span>

<input checked="" class="invisible w-0 absolute" name="view-toggle" type="radio" value="stock"/>

</label>

<label class="relative z-10 flex cursor-pointer h-full grow items-center justify-center overflow-hidden rounded-sm transition-all duration-200 has-[:checked]:bg-primary has-[:checked]:text-white text-white/50 hover:text-white/80">

<span class="text-sm font-bold tracking-wide">Supply History</span>

<input class="invisible w-0 absolute" name="view-toggle" type="radio" value="history"/>

</label>

</div>

</div>

<!-- Stats Grid -->

<div class="grid grid-cols-2 gap-3">

<!-- Total Value Card -->

<div class="col-span-2 flex flex-row items-center justify-between rounded-sm p-4 border border-white/10 bg-surface-dark relative overflow-hidden group">

<div class="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

<div class="flex flex-col gap-1 z-10">

<span class="text-white/50 text-xs font-medium uppercase tracking-wider">Total Asset Value</span>

<span class="text-white text-2xl font-bold tracking-tight">2,450,500 <span class="text-sm font-normal text-white/40 ml-1">XAF</span></span>

</div>

<div class="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-primary border border-white/5">

<span class="material-symbols-outlined">payments</span>

</div>

</div>

<!-- Small Stats Row -->

<div class="flex flex-col justify-between rounded-sm p-3 border border-white/10 bg-surface-dark relative overflow-hidden">

<span class="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Total Items</span>

<span class="text-white text-xl font-bold">1,245</span>

</div>

<div class="flex flex-col justify-between rounded-sm p-3 border border-accent/20 bg-accent-subtle relative overflow-hidden">

<span class="text-accent text-xs font-medium uppercase tracking-wider mb-2">Alerts</span>

<div class="flex items-baseline gap-2">

<span class="text-white text-xl font-bold">3</span>

<span class="text-accent text-xs font-bold bg-accent/20 px-1.5 py-0.5 rounded-sm">Low Stock</span>

</div>

</div>

</div>

<!-- List Section -->

<div class="flex flex-col gap-2">

<div class="flex items-center justify-between pb-2 border-b border-white/5">

<h3 class="text-white text-sm font-bold uppercase tracking-wider text-white/40">Inventory List</h3>

<div class="flex gap-2">

<button class="text-xs text-primary font-medium hover:text-white transition-colors">Category</button>

<span class="text-white/20">|</span>

<button class="text-xs text-white/50 font-medium hover:text-white transition-colors">Status</button>

</div>

</div>

<!-- List Item: Normal -->

<div class="group flex items-center justify-between bg-surface-dark p-3 rounded-sm border border-transparent hover:border-white/10 transition-all cursor-pointer">

<div class="flex flex-col gap-0.5">

<p class="text-white font-medium text-base leading-tight">Guinness Stout (65cl)</p>

<p class="text-white/40 text-xs font-mono">Bar Main • #GS-650</p>

</div>

<div class="flex flex-col items-end gap-0.5">

<p class="text-white font-bold text-lg font-mono">124</p>

<p class="text-primary text-[10px] font-bold uppercase tracking-wide bg-primary/10 px-1.5 rounded-sm">In Stock</p>

</div>

</div>

<!-- List Item: Low Stock -->

<div class="group flex items-center justify-between bg-surface-dark p-3 rounded-sm border border-accent/30 hover:border-accent/50 transition-all cursor-pointer relative overflow-hidden">

<div class="absolute left-0 top-0 bottom-0 w-1 bg-accent"></div>

<div class="flex flex-col gap-0.5 pl-2">

<p class="text-white font-medium text-base leading-tight">Beaufort Light</p>

<p class="text-white/40 text-xs font-mono">Bar Main • #BF-LGT</p>

</div>

<div class="flex flex-col items-end gap-0.5">

<p class="text-accent font-bold text-lg font-mono">4</p>

<div class="flex items-center gap-1">

<span class="material-symbols-outlined text-accent text-[10px]">warning</span>

<p class="text-accent text-[10px] font-bold uppercase tracking-wide">Low Stock</p>

</div>

</div>

</div>

<!-- List Item: Normal -->

<div class="group flex items-center justify-between bg-surface-dark p-3 rounded-sm border border-transparent hover:border-white/10 transition-all cursor-pointer">

<div class="flex flex-col gap-0.5">

<p class="text-white font-medium text-base leading-tight">Jameson Whiskey</p>

<p class="text-white/40 text-xs font-mono">VIP Section • #JM-700</p>

</div>

<div class="flex flex-col items-end gap-0.5">

<p class="text-white font-bold text-lg font-mono">12</p>

<p class="text-primary text-[10px] font-bold uppercase tracking-wide bg-primary/10 px-1.5 rounded-sm">In Stock</p>

</div>

</div>

<!-- List Item: Normal -->

<div class="group flex items-center justify-between bg-surface-dark p-3 rounded-sm border border-transparent hover:border-white/10 transition-all cursor-pointer">

<div class="flex flex-col gap-0.5">

<p class="text-white font-medium text-base leading-tight">Coca-Cola (Glass)</p>

<p class="text-white/40 text-xs font-mono">Bar Main • #CC-330</p>

</div>

<div class="flex flex-col items-end gap-0.5">

<p class="text-white font-bold text-lg font-mono">86</p>

<p class="text-primary text-[10px] font-bold uppercase tracking-wide bg-primary/10 px-1.5 rounded-sm">In Stock</p>

</div>

</div>

<!-- List Item: Low Stock -->

<div class="group flex items-center justify-between bg-surface-dark p-3 rounded-sm border border-accent/30 hover:border-accent/50 transition-all cursor-pointer relative overflow-hidden">

<div class="absolute left-0 top-0 bottom-0 w-1 bg-accent"></div>

<div class="flex flex-col gap-0.5 pl-2">

<p class="text-white font-medium text-base leading-tight">Heineken (33cl)</p>

<p class="text-white/40 text-xs font-mono">Terrace Fridge • #HK-330</p>

</div>

<div class="flex flex-col items-end gap-0.5">

<p class="text-accent font-bold text-lg font-mono">2</p>

<div class="flex items-center gap-1">

<span class="material-symbols-outlined text-accent text-[10px]">warning</span>

<p class="text-accent text-[10px] font-bold uppercase tracking-wide">Critical</p>

</div>

</div>

</div>

<!-- List Item: Normal -->

<div class="group flex items-center justify-between bg-surface-dark p-3 rounded-sm border border-transparent hover:border-white/10 transition-all cursor-pointer">

<div class="flex flex-col gap-0.5">

<p class="text-white font-medium text-base leading-tight">Source Tangui (1.5L)</p>

<p class="text-white/40 text-xs font-mono">Storage B • #WA-150</p>

</div>

<div class="flex flex-col items-end gap-0.5">

<p class="text-white font-bold text-lg font-mono">45</p>

<p class="text-primary text-[10px] font-bold uppercase tracking-wide bg-primary/10 px-1.5 rounded-sm">In Stock</p>

</div>

</div>

</div>

<!-- Spacer for FAB -->

<div class="h-20"></div>

</main>

<!-- Floating Action Button -->

<div class="fixed bottom-6 right-6 z-30">

<button class="flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-5 py-3 rounded-sm shadow-lg shadow-black/50 transition-all transform hover:scale-105 active:scale-95 border border-white/10">

<span class="material-symbols-outlined text-xl">add</span>

<span class="font-bold text-sm tracking-wide uppercase">Add Stock</span>

</button>

</div>

<!-- Bottom Navigation Bar (Context) -->

<nav class="sticky bottom-0 w-full bg-background-dark/95 backdrop-blur-md border-t border-white/5 pb-5 pt-3 px-6 flex justify-between items-end z-20">

<a class="flex flex-col items-center gap-1 group" href="#">

<span class="material-symbols-outlined text-white/40 group-hover:text-primary transition-colors">dashboard</span>

<span class="text-[10px] font-medium text-white/40 group-hover:text-primary uppercase tracking-wide">Dash</span>

</a>

<a class="flex flex-col items-center gap-1 group" href="#">

<span class="material-symbols-outlined text-primary transition-colors">inventory_2</span>

<span class="text-[10px] font-bold text-primary uppercase tracking-wide">Stock</span>

</a>

<a class="flex flex-col items-center gap-1 group" href="#">

<div class="relative">

<span class="material-symbols-outlined text-white/40 group-hover:text-primary transition-colors">point_of_sale</span>

</div>

<span class="text-[10px] font-medium text-white/40 group-hover:text-primary uppercase tracking-wide">Sales</span>

</a>

<a class="flex flex-col items-center gap-1 group" href="#">

<span class="material-symbols-outlined text-white/40 group-hover:text-primary transition-colors">settings</span>

<span class="text-[10px] font-medium text-white/40 group-hover:text-primary uppercase tracking-wide">Admin</span>

</a>

</nav>

</div>

</body></html>

<!-- User & Roles Management -->

<!DOCTYPE html>

<html class="light" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>User &amp; Roles Management</title>

<!-- Google Fonts -->

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>

<!-- Material Symbols -->

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<!-- Tailwind CSS -->

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Tailwind Config -->

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#00476b",

                        "background-light": "#f9fafb",

                        "background-dark": "#1a1a1a",

                        "surface-light": "#ffffff",

                        "surface-dark": "#2a2a2a",

                        "role-manager": "#D4AF37",

                        "role-waitress": "#3399FF",

                        "role-counter": "#7A33FF",

                        "role-patron": "#28A745",

                    },

                    fontFamily: {

                        "display": ["Manrope", "sans-serif"]

                    },

                    borderRadius: {

                        "DEFAULT": "0.25rem",

                        "md": "0.375rem",

                        "lg": "0.5rem",

                        "xl": "0.75rem",

                        "2xl": "1rem",

                        "full": "9999px"

                    },

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar hiding for clean UI */

        .no-scrollbar::-webkit-scrollbar {

            display: none;

        }

        .no-scrollbar {

            -ms-overflow-style: none;

            scrollbar-width: none;

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 font-display transition-colors duration-200">

<div class="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-background-light dark:bg-background-dark shadow-xl overflow-hidden">

<!-- Header Section -->

<header class="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">

<div class="flex items-center justify-between p-4 pb-2">

<div class="flex flex-col">

<h2 class="text-[#0c171d] dark:text-white text-xl font-extrabold leading-tight tracking-[-0.015em]">User Management</h2>

<span class="text-xs text-slate-500 dark:text-slate-400 font-medium">Bar Security &amp; Access Control</span>

</div>

<div class="flex items-center gap-2">

<button class="flex items-center justify-center w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-colors">

<span class="material-symbols-outlined text-xl">tune</span>

</button>

</div>

</div>

<!-- Search Bar -->

<div class="px-4 pb-3 pt-1">

<div class="relative flex w-full items-center">

<span class="material-symbols-outlined absolute left-3 text-slate-400 dark:text-slate-500 text-[20px]">search</span>

<input class="w-full rounded-xl bg-slate-100 dark:bg-white/5 border-none py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-primary/50 transition-all" placeholder="Search name, role or ID..." type="text"/>

</div>

</div>

</header>

<!-- Main Content Scroll Area -->

<main class="flex-1 overflow-y-auto p-4 space-y-4 pb-24">

<!-- Quick Action: Add User -->

<button class="group w-full flex items-center justify-between bg-primary hover:bg-primary/90 text-white rounded-xl p-4 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">

<div class="flex items-center gap-3">

<div class="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 text-white">

<span class="material-symbols-outlined">person_add</span>

</div>

<div class="flex flex-col items-start">

<span class="text-base font-bold">Add New User</span>

<span class="text-xs text-white/80">Onboard employee or patron</span>

</div>

</div>

<span class="material-symbols-outlined text-white/80 group-hover:translate-x-1 transition-transform">arrow_forward</span>

</button>

<!-- Section Title -->

<div class="flex items-center justify-between pt-2">

<h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Personnel</h3>

<span class="text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">4 Online</span>

</div>

<!-- Employee List -->

<div class="flex flex-col gap-3">

<!-- Manager Card -->

<div class="group relative flex flex-col bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">

<div class="flex items-start gap-4">

<div class="relative shrink-0">

<div class="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center ring-2 ring-white dark:ring-gray-800 shadow-sm" data-alt="Portrait of a male manager in a suit" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBl5FHriZsHpHTrk0vxhTFKTcNZpxHuPuvLQz01yw8O5yGV9HmVC44aZ8EtmQ07Be-aQkfxDAXH8EjXWIEF1nsEKNrsbklh7bF62R9-V6VD4GBA03t5Lh6WVd2MJSLjHFVVzkuWD_-9JDt35DXfkIBIla3aFTdKHxq7xmAiZM9yd4KXr_G3KeJy4NRayH7KUJyojBAzKCkdikcM7rcvduLo7ZguniS4VckQwusCf5HezULMDrrTf4WcwwhJxhS_fhOBSxyglYtgbB10");'></div>

<div class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-light dark:bg-surface-dark ring-2 ring-white dark:ring-gray-800">

<div class="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse"></div>

</div>

</div>

<div class="flex-1 min-w-0">

<div class="flex items-center justify-between mb-1">

<h4 class="text-base font-bold text-slate-900 dark:text-white truncate">Jean-Pierre T.</h4>

<span class="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">more_horiz</span>

</div>

<div class="flex flex-wrap items-center gap-2 mb-2">

<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#D4AF37] text-white shadow-sm">

<span class="material-symbols-outlined text-[12px] -ml-0.5">lock</span>

                                    Manager

                                </span>

<span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">

<span class="material-symbols-outlined text-[14px]">schedule</span>

                                    Just now

                                </span>

</div>

</div>

</div>

</div>

<!-- Counter Staff Card -->

<div class="group relative flex flex-col bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">

<div class="flex items-start gap-4">

<div class="relative shrink-0">

<div class="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center ring-2 ring-white dark:ring-gray-800 shadow-sm" data-alt="Portrait of a female staff member smiling" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBzt3PMjf5cAozH--Xp-GbgPeYKxvuykzk9_T4jvS-jTldLcguSd2Li-uMXMNJmX5PvrxaT4vTcdPZAvCznFaeuM4J8Ue3txAfoK62sNaTbjJ9SBonvqa1gzbIveLDE8M6XTLhCpoKTdsjU104e1c5Bw-OVrZh8llAO19VmFPAcPSOuaq_iF92n5fbyiP_Otm3wTwXq6OfavEH-jz6lW5fO9yWv0Bd5mbsOcvG-oNoreAW1nAPiNkOmIq74BGbJw8rQ5qlmq7nNvv3h");'></div>

<div class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-light dark:bg-surface-dark ring-2 ring-white dark:ring-gray-800">

<div class="h-2.5 w-2.5 rounded-full bg-green-500"></div>

</div>

</div>

<div class="flex-1 min-w-0">

<div class="flex items-center justify-between mb-1">

<h4 class="text-base font-bold text-slate-900 dark:text-white truncate">Marie C.</h4>

<span class="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">more_horiz</span>

</div>

<div class="flex flex-wrap items-center gap-2 mb-2">

<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#7A33FF] text-white shadow-sm">

                                    Counter

                                </span>

<span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">

<span class="material-symbols-outlined text-[14px]">schedule</span>

                                    10m ago

                                </span>

</div>

</div>

</div>

</div>

<!-- Waitress Card -->

<div class="group relative flex flex-col bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all active:scale-[0.99]">

<div class="flex items-start gap-4">

<div class="relative shrink-0">

<div class="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-700 bg-cover bg-center ring-2 ring-white dark:ring-gray-800 shadow-sm" data-alt="Portrait of a young waitress" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDLYazr1Zc_v1-951-zye291pHlvvkzEeVbgdXYDbqT8dnVSmlmh2gyb7XLxEGxNnmH0pCJZ4XqvMubHQBRW24kEMWbDvV3z4Dyayp0WjEjVDFk04V_2GGIV5FIYGoxpCCc71htLDbxWMJaP-5-R7dpFq2z-dpkWmCJNSmE05ERsJVfXzfxIPzBec74bEp5wQ-rQPvBaKtCGmZuorxSsXdjzm4rwTF-q8nxmF4YRl60PV0EJG7IHCkqbefolNU8cAPHgBdu58OOzakm");'></div>

<div class="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-light dark:bg-surface-dark ring-2 ring-white dark:ring-gray-800">

<div class="h-2.5 w-2.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>

</div>

</div>

<div class="flex-1 min-w-0">

<div class="flex items-center justify-between mb-1">

<h4 class="text-base font-bold text-slate-900 dark:text-white truncate">Sarah K.</h4>

<span class="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">more_horiz</span>

</div>

<div class="flex flex-wrap items-center gap-2 mb-2">

<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#3399FF] text-white shadow-sm">

                                    Waitress

                                </span>

<span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">

<span class="material-symbols-outlined text-[14px]">schedule</span>

                                    1d ago

                                </span>

</div>

</div>

</div>

</div>

<!-- Patron Card (Contextual) -->

<div class="group relative flex flex-col bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-xl p-3.5 shadow-sm opacity-90 hover:opacity-100 hover:shadow-md transition-all active:scale-[0.99]">

<div class="flex items-start gap-4">

<div class="relative shrink-0">

<!-- Initials Avatar for Patron -->

<div class="h-14 w-14 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center ring-2 ring-white dark:ring-gray-800 shadow-sm">

<span class="text-lg font-bold text-gray-500 dark:text-gray-300">LC</span>

</div>

</div>

<div class="flex-1 min-w-0">

<div class="flex items-center justify-between mb-1">

<h4 class="text-base font-bold text-slate-900 dark:text-white truncate">Loyal Customer 01</h4>

<span class="material-symbols-outlined text-gray-300 dark:text-gray-600 text-lg">more_horiz</span>

</div>

<div class="flex flex-wrap items-center gap-2 mb-2">

<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-[#28A745] text-white shadow-sm">

                                    Patron

                                </span>

<span class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">

<span class="material-symbols-outlined text-[14px]">schedule</span>

                                    2d ago

                                </span>

</div>

</div>

</div>

</div>

</div>

<!-- End of list spacer -->

<div class="h-8"></div>

</main>

<!-- Bottom Tab Bar (Contextual Mockup) -->

<nav class="fixed bottom-0 w-full max-w-md bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 pb-safe pt-2 px-6 flex justify-between items-center z-30 pb-4">

<button class="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors">

<span class="material-symbols-outlined">dashboard</span>

<span class="text-[10px] font-medium">Home</span>

</button>

<button class="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors">

<span class="material-symbols-outlined">inventory_2</span>

<span class="text-[10px] font-medium">Stock</span>

</button>

<div class="flex flex-col items-center gap-1 text-primary">

<span class="material-symbols-outlined fill-current">badge</span>

<span class="text-[10px] font-bold">Staff</span>

</div>

<button class="flex flex-col items-center gap-1 text-slate-400 hover:text-primary transition-colors">

<span class="material-symbols-outlined">settings</span>

<span class="text-[10px] font-medium">Settings</span>

</button>

</nav>

</div>

</body></html>

<!-- Record New Supply Arrival -->

<!DOCTYPE html>

<html class="dark"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Financial Performance Dashboard</title>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

      tailwind.config = {

        darkMode: "class",

        theme: {

          extend: {

            colors: {

              "navy": "#0f172a",

              "navy-light": "#334155",

              "primary": "#1e3a8a", 

              "primary-light": "#3b82f6",

              "success": "#10b981",

              "warning": "#f59e0b",

              "danger": "#ef4444",

              "background-light": "#f8fafc",

              "background-dark": "#020617","card-light": "#ffffff",

              "card-dark": "#0f172a","border-light": "#e2e8f0",

              "border-dark": "#1e293b","chart-cyan": "#22d3ee",

              "chart-emerald": "#34d399",

            },

            fontFamily: {

              "display": ["Manrope", "sans-serif"]

            },

            borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "2xl": "1rem", "full": "9999px"},

            boxShadow: {

                "soft": "0 4px 20px -2px rgba(0, 0, 0, 0.05)",

                "glow": "0 0 15px rgba(34, 211, 238, 0.15)", 

            }

          },

        },

      }

    </script>

<style>::-webkit-scrollbar { width: 0px; background: transparent; }

        body { min-height: 100vh; }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden min-h-screen flex flex-col pb-20">

<header class="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/80 backdrop-blur-xl border-b border-transparent dark:border-border-dark transition-colors duration-300">

<div class="flex items-center justify-between px-6 py-4">

<div>

<h1 class="text-2xl font-extrabold tracking-tight text-navy dark:text-white">Dashboard</h1>

<p class="text-sm font-medium text-slate-500 dark:text-slate-400">Welcome back, Owner</p>

</div>

<button aria-label="Notifications" class="p-2.5 rounded-full bg-white dark:bg-card-dark border border-border-light dark:border-border-dark shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative">

<span class="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-card-dark"></span>

<span class="material-symbols-outlined text-navy dark:text-white text-[22px]">notifications</span>

</button>

</div>

</header>

<main class="flex-1 px-6 space-y-8 pt-4">

<section class="space-y-4">

<div class="relative overflow-hidden bg-navy dark:bg-gradient-to-br dark:from-slate-800 dark:to-slate-900 rounded-2xl p-6 shadow-soft dark:shadow-glow dark:border dark:border-slate-700/50 text-white group">

<div class="absolute top-0 right-0 w-48 h-48 bg-primary-light/20 dark:bg-cyan-500/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary-light/30 transition-all duration-700"></div>

<div class="relative z-10 flex flex-col h-full justify-between space-y-6">

<div class="flex items-center justify-between">

<span class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Daily Revenue (CA)</span>

<div class="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/5">

<span class="material-symbols-outlined text-success dark:text-emerald-400 text-[16px]">trending_up</span>

<span class="text-xs font-bold text-success dark:text-emerald-400">+12.5%</span>

</div>

</div>

<div>

<div class="flex items-baseline gap-2">

<span class="text-4xl font-extrabold tracking-tight">450,000</span>

<span class="text-base font-medium text-slate-400">FCFA</span>

</div>

<div class="mt-4 pt-4 border-t border-white/10 flex justify-between text-xs text-slate-400">

<span>Target: 400k</span>

<span>Yesterday: 402k</span>

</div>

</div>

</div>

</div>

<div class="grid grid-cols-2 gap-4">

<div class="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-soft hover:border-primary/30 dark:hover:border-slate-600 transition-colors">

<div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border dark:border-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">

<span class="material-symbols-outlined">payments</span>

</div>

<p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Collections</p>

<p class="text-xl font-bold text-navy dark:text-white mt-1">380k</p>

<div class="w-full bg-slate-100 dark:bg-slate-800 h-1 mt-3 rounded-full overflow-hidden">

<div class="bg-blue-500 dark:bg-blue-400 h-full rounded-full" style="width: 85%"></div>

</div>

</div>

<div class="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-soft hover:border-primary/30 dark:hover:border-slate-600 transition-colors">

<div class="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/50 border dark:border-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3">

<span class="material-symbols-outlined">pending_actions</span>

</div>

<p class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Debt</p>

<p class="text-xl font-bold text-navy dark:text-white mt-1">70k</p>

<p class="text-[10px] text-orange-600 dark:text-orange-400 mt-2 font-medium flex items-center gap-1">

<span class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>

                    Needs Action

                </p>

</div>

</div>

</section>

<section class="bg-card-light dark:bg-card-dark rounded-2xl p-6 border border-border-light dark:border-border-dark shadow-soft">

<div class="flex items-center justify-between mb-8">

<div>

<h3 class="text-base font-bold text-navy dark:text-white">Financial Trends</h3>

<p class="text-xs text-slate-500 dark:text-slate-400">Revenue vs Profit (Last 7 Days)</p>

</div>

<div class="flex items-center gap-4">

<div class="flex items-center gap-1.5">

<span class="w-2.5 h-2.5 rounded-full bg-navy dark:bg-cyan-400"></span>

<span class="text-xs font-medium text-slate-600 dark:text-slate-300">Rev</span>

</div>

<div class="flex items-center gap-1.5">

<span class="w-2.5 h-2.5 rounded-full bg-success dark:bg-emerald-500"></span>

<span class="text-xs font-medium text-slate-600 dark:text-slate-300">Net</span>

</div>

</div>

</div>

<div class="relative w-full aspect-[2/1]">

<svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 150">

<line class="stroke-slate-200 dark:stroke-slate-800" stroke-dasharray="4 4" stroke-width="1" x1="0" x2="300" y1="150" y2="150"></line>

<line class="stroke-slate-100 dark:stroke-slate-800/60" stroke-dasharray="4 4" stroke-width="1" x1="0" x2="300" y1="100" y2="100"></line>

<line class="stroke-slate-100 dark:stroke-slate-800/60" stroke-dasharray="4 4" stroke-width="1" x1="0" x2="300" y1="50" y2="50"></line>

<path class="drop-shadow-sm dark:stroke-emerald-500" d="M0,120 C50,115 50,90 100,100 C150,110 150,80 200,90 C250,100 250,70 300,80" fill="none" stroke="#10b981" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></path>

<path class="drop-shadow-md dark:stroke-cyan-400 dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]" d="M0,80 C50,70 50,40 100,50 C150,60 150,30 200,40 C250,50 250,10 300,20" fill="none" stroke="#0f172a" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></path>

<g class="text-[10px] font-medium fill-slate-400 dark:fill-slate-500" transform="translate(0, 170)">

<text text-anchor="start" x="0">Mon</text>

<text text-anchor="middle" x="100">Wed</text>

<text text-anchor="middle" x="200">Fri</text>

<text text-anchor="end" x="300">Sun</text>

</g>

</svg>

</div>

</section>

<section>

<div class="flex items-center justify-between mb-4 px-1">

<h3 class="text-base font-bold text-navy dark:text-white">Performance by Category</h3>

<button class="text-xs font-semibold text-primary dark:text-blue-400 hover:text-primary-dark">View Report</button>

</div>

<div class="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark divide-y divide-border-light dark:divide-border-dark shadow-soft overflow-hidden">

<div class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">

<div class="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">

<span class="material-symbols-outlined">sports_bar</span>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-center mb-1.5">

<span class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">Beers</span>

<span class="text-sm font-bold text-slate-800 dark:text-white">280k</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">

<div class="bg-amber-500 dark:bg-amber-400 h-full rounded-full" style="width: 65%"></div>

</div>

</div>

</div>

<div class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">

<div class="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">

<span class="material-symbols-outlined">liquor</span>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-center mb-1.5">

<span class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">Spirits &amp; Wines</span>

<span class="text-sm font-bold text-slate-800 dark:text-white">120k</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">

<div class="bg-purple-500 dark:bg-purple-400 h-full rounded-full" style="width: 28%"></div>

</div>

</div>

</div>

<div class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">

<div class="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">

<span class="material-symbols-outlined">water_drop</span>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-center mb-1.5">

<span class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">Soft Drinks</span>

<span class="text-sm font-bold text-slate-800 dark:text-white">50k</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">

<div class="bg-teal-500 dark:bg-teal-400 h-full rounded-full" style="width: 12%"></div>

</div>

</div>

</div>

</div>

</section>

</main>

<nav class="fixed bottom-0 w-full bg-white/95 dark:bg-background-dark/95 backdrop-blur-lg border-t border-border-light dark:border-border-dark pb-safe z-50">

<div class="flex justify-around items-center h-16">

<button class="flex flex-col items-center gap-1 w-full text-navy dark:text-white">

<span class="material-symbols-outlined fill-current">analytics</span>

<span class="text-[10px] font-bold">Overview</span>

</button>

<button class="flex flex-col items-center gap-1 w-full text-slate-400 hover:text-navy dark:hover:text-white transition-colors">

<span class="material-symbols-outlined">inventory_2</span>

<span class="text-[10px] font-medium">Stock</span>

</button>

<button class="flex flex-col items-center gap-1 w-full text-slate-400 hover:text-navy dark:hover:text-white transition-colors">

<span class="material-symbols-outlined">receipt_long</span>

<span class="text-[10px] font-medium">Sales</span>

</button>

<button class="flex flex-col items-center gap-1 w-full text-slate-400 hover:text-navy dark:hover:text-white transition-colors">

<span class="material-symbols-outlined">settings</span>

<span class="text-[10px] font-medium">Settings</span>

</button>

</div>

</nav>

</body></html>

<!-- Record New Supply Arrival -->

<!DOCTYPE html>

<html class="light"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Financial Performance Dashboard</title>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

      tailwind.config = {

        darkMode: "class",

        theme: {

          extend: {

            colors: {

              "navy": "#0f172a",

              "navy-light": "#334155",

              "primary": "#1e3a8a", 

              "primary-light": "#3b82f6",

              "success": "#10b981",

              "warning": "#f59e0b",

              "danger": "#ef4444",

              "background-light": "#f8fafc",

              "background-dark": "#111827",

              "card-light": "#ffffff",

              "card-dark": "#1f2937",

              "border-light": "#e2e8f0",

              "border-dark": "#374151",

            },

            fontFamily: {

              "display": ["Manrope", "sans-serif"]

            },

            borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "2xl": "1rem", "full": "9999px"},

            boxShadow: {

                "soft": "0 4px 20px -2px rgba(0, 0, 0, 0.05)",

            }

          },

        },

      }

    </script>

<style>::-webkit-scrollbar { width: 0px; background: transparent; }

        body { min-height: 100vh; }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden min-h-screen flex flex-col pb-20">

<header class="sticky top-0 z-40 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-transparent transition-colors duration-300">

<div class="flex items-center justify-between px-6 py-4">

<div>

<h1 class="text-2xl font-extrabold tracking-tight text-navy dark:text-white">Dashboard</h1>

<p class="text-sm font-medium text-slate-500 dark:text-slate-400">Welcome back, Owner</p>

</div>

<button aria-label="Notifications" class="p-2.5 rounded-full bg-white dark:bg-card-dark border border-border-light dark:border-border-dark shadow-sm hover:bg-slate-50 transition-colors relative">

<span class="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-card-dark"></span>

<span class="material-symbols-outlined text-navy dark:text-white text-[22px]">notifications</span>

</button>

</div>

</header>

<main class="flex-1 px-6 space-y-8 pt-2">

<section class="space-y-4">

<div class="relative overflow-hidden bg-navy dark:bg-slate-900 rounded-2xl p-6 shadow-soft text-white group">

<div class="absolute top-0 right-0 w-48 h-48 bg-primary-light/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary-light/30 transition-all duration-700"></div>

<div class="relative z-10 flex flex-col h-full justify-between space-y-6">

<div class="flex items-center justify-between">

<span class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Daily Revenue (CA)</span>

<div class="flex items-center gap-1 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg border border-white/5">

<span class="material-symbols-outlined text-success text-[16px]">trending_up</span>

<span class="text-xs font-bold text-success">+12.5%</span>

</div>

</div>

<div>

<div class="flex items-baseline gap-2">

<span class="text-4xl font-extrabold tracking-tight">450,000</span>

<span class="text-base font-medium text-slate-400">FCFA</span>

</div>

<div class="mt-4 pt-4 border-t border-white/10 flex justify-between text-xs text-slate-400">

<span>Target: 400k</span>

<span>Yesterday: 402k</span>

</div>

</div>

</div>

</div>

<div class="grid grid-cols-2 gap-4">

<div class="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-soft hover:border-primary/30 transition-colors">

<div class="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">

<span class="material-symbols-outlined">payments</span>

</div>

<p class="text-xs font-bold text-slate-500 uppercase tracking-wide">Collections</p>

<p class="text-xl font-bold text-navy dark:text-white mt-1">380k</p>

<div class="w-full bg-slate-100 dark:bg-slate-800 h-1 mt-3 rounded-full overflow-hidden">

<div class="bg-blue-500 h-full rounded-full" style="width: 85%"></div>

</div>

</div>

<div class="bg-card-light dark:bg-card-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-soft hover:border-primary/30 transition-colors">

<div class="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400 mb-3">

<span class="material-symbols-outlined">pending_actions</span>

</div>

<p class="text-xs font-bold text-slate-500 uppercase tracking-wide">Debt</p>

<p class="text-xl font-bold text-navy dark:text-white mt-1">70k</p>

<p class="text-[10px] text-orange-600 mt-2 font-medium flex items-center gap-1">

<span class="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>

                    Needs Action

                </p>

</div>

</div>

</section>

<section class="bg-card-light dark:bg-card-dark rounded-2xl p-6 border border-border-light dark:border-border-dark shadow-soft">

<div class="flex items-center justify-between mb-8">

<div>

<h3 class="text-base font-bold text-navy dark:text-white">Financial Trends</h3>

<p class="text-xs text-slate-500">Revenue vs Profit (Last 7 Days)</p>

</div>

<div class="flex items-center gap-4">

<div class="flex items-center gap-1.5">

<span class="w-2.5 h-2.5 rounded-full bg-navy dark:bg-slate-400"></span>

<span class="text-xs font-medium text-slate-600 dark:text-slate-400">Rev</span>

</div>

<div class="flex items-center gap-1.5">

<span class="w-2.5 h-2.5 rounded-full bg-success"></span>

<span class="text-xs font-medium text-slate-600 dark:text-slate-400">Net</span>

</div>

</div>

</div>

<div class="relative w-full aspect-[2/1]">

<svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 150">

<line stroke="#e2e8f0" stroke-dasharray="4 4" stroke-width="1" x1="0" x2="300" y1="150" y2="150"></line>

<line stroke="#f1f5f9" stroke-dasharray="4 4" stroke-width="1" x1="0" x2="300" y1="100" y2="100"></line>

<line stroke="#f1f5f9" stroke-dasharray="4 4" stroke-width="1" x1="0" x2="300" y1="50" y2="50"></line>

<path class="drop-shadow-sm" d="M0,120 C50,115 50,90 100,100 C150,110 150,80 200,90 C250,100 250,70 300,80" fill="none" stroke="#10b981" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></path>

<path class="dark:stroke-slate-300 drop-shadow-md" d="M0,80 C50,70 50,40 100,50 C150,60 150,30 200,40 C250,50 250,10 300,20" fill="none" stroke="#0f172a" stroke-linecap="round" stroke-linejoin="round" stroke-width="3"></path>

<g class="text-[10px] font-medium fill-slate-400" transform="translate(0, 170)">

<text text-anchor="start" x="0">Mon</text>

<text text-anchor="middle" x="100">Wed</text>

<text text-anchor="middle" x="200">Fri</text>

<text text-anchor="end" x="300">Sun</text>

</g>

</svg>

</div>

</section>

<section>

<div class="flex items-center justify-between mb-4 px-1">

<h3 class="text-base font-bold text-navy dark:text-white">Performance by Category</h3>

<button class="text-xs font-semibold text-primary hover:text-primary-dark">View Report</button>

</div>

<div class="bg-card-light dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark divide-y divide-border-light dark:divide-border-dark shadow-soft overflow-hidden">

<div class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">

<div class="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">

<span class="material-symbols-outlined">sports_bar</span>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-center mb-1.5">

<span class="text-sm font-bold text-slate-800 dark:text-white truncate">Beers</span>

<span class="text-sm font-bold text-slate-800 dark:text-white">280k</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">

<div class="bg-amber-500 h-full rounded-full" style="width: 65%"></div>

</div>

</div>

</div>

<div class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">

<div class="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">

<span class="material-symbols-outlined">liquor</span>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-center mb-1.5">

<span class="text-sm font-bold text-slate-800 dark:text-white truncate">Spirits &amp; Wines</span>

<span class="text-sm font-bold text-slate-800 dark:text-white">120k</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">

<div class="bg-purple-500 h-full rounded-full" style="width: 28%"></div>

</div>

</div>

</div>

<div class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">

<div class="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">

<span class="material-symbols-outlined">water_drop</span>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-center mb-1.5">

<span class="text-sm font-bold text-slate-800 dark:text-white truncate">Soft Drinks</span>

<span class="text-sm font-bold text-slate-800 dark:text-white">50k</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">

<div class="bg-teal-500 h-full rounded-full" style="width: 12%"></div>

</div>

</div>

</div>

</div>

</section>

</main>

<nav class="fixed bottom-0 w-full bg-white/95 dark:bg-card-dark/95 backdrop-blur-lg border-t border-border-light dark:border-border-dark pb-safe z-50">

<div class="flex justify-around items-center h-16">

<button class="flex flex-col items-center gap-1 w-full text-navy dark:text-white">

<span class="material-symbols-outlined fill-current">analytics</span>

<span class="text-[10px] font-bold">Overview</span>

</button>

<button class="flex flex-col items-center gap-1 w-full text-slate-400 hover:text-navy dark:hover:text-white transition-colors">

<span class="material-symbols-outlined">inventory_2</span>

<span class="text-[10px] font-medium">Stock</span>

</button>

<button class="flex flex-col items-center gap-1 w-full text-slate-400 hover:text-navy dark:hover:text-white transition-colors">

<span class="material-symbols-outlined">receipt_long</span>

<span class="text-[10px] font-medium">Sales</span>

</button>

<button class="flex flex-col items-center gap-1 w-full text-slate-400 hover:text-navy dark:hover:text-white transition-colors">

<span class="material-symbols-outlined">settings</span>

<span class="text-[10px] font-medium">Settings</span>

</button>

</div>

</nav>

</body></html>

<!-- Billing and Payment Entry -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Billing and Payment Entry</title>

<!-- Fonts -->

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<!-- Tailwind CSS -->

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Tailwind Configuration -->

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#2c576d",

                        "primary-light": "#3a6e88",

                        "background-light": "#f9fafb",

                        "background-dark": "#191b1f",

                        "surface-dark": "#272A2E",

                        "accent-gold": "#C3A66B",

                        "border-dark": "#3f515a",

                    },

                    fontFamily: {

                        "display": ["Space Grotesk", "sans-serif"]

                    },

                    borderRadius: {

                        "DEFAULT": "0.125rem", 

                        "sm": "0.25rem", // 4px industrial corner

                        "lg": "0.5rem", 

                        "xl": "0.75rem", 

                        "full": "9999px"

                    },

                    boxShadow: {

                        'glow': '0 0 10px rgba(44, 87, 109, 0.5)',

                        'inner-border': 'inset 0 0 0 1px rgba(255, 255, 255, 0.05)'

                    }

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar for industrial feel */

        ::-webkit-scrollbar {

            width: 4px;

        }

        ::-webkit-scrollbar-track {

            background: #191b1f;

        }

        ::-webkit-scrollbar-thumb {

            background: #3f515a;

            border-radius: 2px;

        }

        

        /* Dashed border utility */

        .dashed-separator {

            background-image: linear-gradient(to right, #3f515a 50%, rgba(255,255,255,0) 0%);

            background-position: bottom;

            background-size: 10px 1px;

            background-repeat: repeat-x;

        }

        .ticket-edge {

             mask-image: radial-gradient(circle at 10px bottom, transparent 10px, black 10.5px);

             mask-position: -10px bottom;

             mask-size: 20px 20px;

             mask-repeat: repeat-x;

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display text-white overflow-hidden h-screen flex flex-col selection:bg-accent-gold selection:text-black">

<!-- Top App Bar -->

<div class="flex items-center p-4 pt-6 pb-2 justify-between shrink-0 z-10 bg-background-dark border-b border-border-dark/30">

<button class="text-gray-400 hover:text-white transition-colors text-sm font-medium tracking-wide flex items-center gap-1 group">

<span class="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">close</span>

            CANCEL

        </button>

<h2 class="text-white text-lg font-bold leading-tight tracking-tight uppercase">Payment Entry</h2>

<div class="w-[70px]"></div> <!-- Spacer to balance header -->

</div>

<!-- Main Scrollable Content -->

<div class="flex-1 overflow-y-auto p-4 flex flex-col gap-6 relative">

<!-- The Receipt Slab -->

<div class="w-full bg-surface-dark rounded-sm border border-border-dark/50 shadow-inner-border relative flex flex-col">

<!-- Technical Info Grid -->

<div class="grid grid-cols-3 border-b border-border-dark/50 divide-x divide-border-dark/50">

<div class="p-3 text-center">

<p class="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Order ID</p>

<p class="text-white text-lg font-bold leading-none">#1024</p>

</div>

<div class="p-3 text-center">

<p class="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Table</p>

<p class="text-white text-lg font-bold leading-none">05</p>

</div>

<div class="p-3 text-center">

<p class="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Server</p>

<p class="text-white text-lg font-bold leading-none">Jean</p>

</div>

</div>

<!-- Receipt Items -->

<div class="p-5 flex flex-col gap-3">

<div class="flex justify-between items-start gap-4">

<div class="flex flex-col">

<p class="text-gray-300 text-sm font-medium">Guinness Large</p>

<p class="text-gray-500 text-xs">Qty: 2</p>

</div>

<p class="text-white text-sm font-bold tracking-wide">3,000 FCFA</p>

</div>

<div class="flex justify-between items-start gap-4">

<div class="flex flex-col">

<p class="text-gray-300 text-sm font-medium">Roasted Fish (Bar) </p>

<p class="text-gray-500 text-xs">Qty: 1</p>

</div>

<p class="text-white text-sm font-bold tracking-wide">4,500 FCFA</p>

</div>

<!-- Tax Line -->

<div class="flex justify-between items-start gap-4 pt-2 mt-1">

<p class="text-gray-500 text-xs">Tax (19.25%)</p>

<p class="text-gray-400 text-xs font-mono">1,443 FCFA</p>

</div>

</div>

<!-- Dashed Divider -->

<div class="h-px w-full dashed-separator opacity-30"></div>

<!-- Total Section -->

<div class="p-5 pt-4 bg-white/5">

<div class="flex flex-col items-center justify-center gap-1">

<span class="text-gray-400 text-xs uppercase tracking-[0.2em]">Total Due</span>

<h1 class="text-4xl font-bold tracking-tight text-white mt-1">8,943 <span class="text-lg font-medium text-gray-400">FCFA</span></h1>

</div>

</div>

<!-- Decorative jagged bottom edge -->

<div class="absolute -bottom-2 left-0 right-0 h-2 bg-surface-dark ticket-edge hidden"></div>

</div>

<!-- Controls Deck -->

<div class="flex flex-col gap-4">

<!-- Partial Payment Toggle -->

<label class="flex items-center gap-4 bg-surface-dark p-4 rounded-sm border border-border-dark/50 cursor-pointer select-none group">

<div class="text-accent-gold bg-accent-gold/10 flex items-center justify-center rounded-sm shrink-0 size-10 border border-accent-gold/20">

<span class="material-symbols-outlined">call_split</span>

</div>

<div class="flex-1">

<p class="text-white text-base font-medium leading-tight">Partial / Split Payment</p>

<p class="text-gray-500 text-xs mt-1">Split bill across multiple methods</p>

</div>

<div class="shrink-0 relative">

<input class="peer sr-only" type="checkbox"/>

<div class="h-6 w-11 rounded-full bg-gray-700 border border-gray-600 peer-checked:bg-accent-gold peer-checked:border-accent-gold transition-colors"></div>

<div class="absolute top-1 left-1 bg-white h-4 w-4 rounded-full transition-all peer-checked:translate-x-5 shadow-sm"></div>

</div>

</label>

<!-- Payment Methods Grid -->

<div>

<p class="text-xs uppercase text-gray-500 font-bold tracking-wider mb-3 ml-1">Select Payment Method</p>

<div class="grid grid-cols-3 gap-3">

<!-- Cash -->

<button class="relative flex flex-col items-center justify-center gap-3 h-24 rounded-sm border-2 border-primary bg-primary/20 hover:bg-primary/30 transition-all group">

<div class="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse"></div>

<span class="material-symbols-outlined text-3xl text-white group-hover:scale-110 transition-transform">payments</span>

<span class="text-xs font-bold tracking-wide uppercase">Cash</span>

</button>

<!-- Mobile Money -->

<button class="relative flex flex-col items-center justify-center gap-3 h-24 rounded-sm border border-border-dark bg-surface-dark hover:border-gray-500 transition-all group opacity-60 hover:opacity-100">

<span class="material-symbols-outlined text-3xl text-white group-hover:scale-110 transition-transform">smartphone</span>

<div class="flex flex-col items-center">

<span class="text-xs font-bold tracking-wide uppercase">Mobile</span>

<span class="text-[9px] text-gray-400">MTN / Orange</span>

</div>

</button>

<!-- Card -->

<button class="relative flex flex-col items-center justify-center gap-3 h-24 rounded-sm border border-border-dark bg-surface-dark hover:border-gray-500 transition-all group opacity-60 hover:opacity-100">

<span class="material-symbols-outlined text-3xl text-white group-hover:scale-110 transition-transform">credit_card</span>

<span class="text-xs font-bold tracking-wide uppercase">Card</span>

</button>

</div>

</div>

<!-- Keypad Placeholder (Conditional) -->

<div class="bg-surface-dark border border-border-dark/50 p-4 rounded-sm flex justify-between items-center">

<div class="flex flex-col">

<span class="text-xs text-gray-500 uppercase">Tendered Amount</span>

<span class="text-2xl font-bold text-white">8,943</span>

</div>

<button class="h-10 w-10 flex items-center justify-center rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors">

<span class="material-symbols-outlined text-sm">edit</span>

</button>

</div>

</div>

<!-- Bottom Spacer -->

<div class="h-20"></div>

</div>

<!-- Sticky Footer Action -->

<div class="shrink-0 p-4 bg-background-dark border-t border-border-dark/30 backdrop-blur-sm bg-opacity-95 z-20">

<button class="w-full h-14 bg-gradient-to-r from-primary to-primary-light hover:to-primary text-white font-bold text-lg tracking-wide rounded-sm shadow-glow flex items-center justify-center gap-3 active:scale-[0.99] transition-all">

<span class="material-symbols-outlined">check_circle</span>

            CONFIRM PAYMENT

        </button>

</div>

</body></html>

<!-- Counter Order Validation -->

<!DOCTYPE html>

<html class="light" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Counter Order Validation</title>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#19304d",

                        "secondary": "#5c708a",

                        "danger": "#D9534F",

                        "warning": "#f59e0b",

                        "background-light": "#f2f4f7", // Slightly grey for contrast with white cards

                        "background-dark": "#121212",

                        "surface-light": "#ffffff",

                        "surface-dark": "#1e1e1e",

                    },

                    fontFamily: {

                        "display": ["Work Sans", "sans-serif"]

                    },

                    borderRadius: {"DEFAULT": "0.5rem", "lg": "0.75rem", "xl": "1rem", "2xl": "1.5rem", "full": "9999px"},

                    boxShadow: {

                        'card': '0 2px 8px -1px rgba(25, 48, 77, 0.08), 0 1px 4px -1px rgba(25, 48, 77, 0.04)',

                        'float': '0 10px 30px -5px rgba(25, 48, 77, 0.15)',

                    }

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar for clean look */

        ::-webkit-scrollbar {

            width: 4px;

        }

        ::-webkit-scrollbar-track {

            background: transparent; 

        }

        ::-webkit-scrollbar-thumb {

            background: #cbd5e1; 

            border-radius: 4px;

        }

        .ticket-jagged-edge {

            background-image: linear-gradient(135deg, transparent 50%, #ffffff 50%), linear-gradient(45deg, #ffffff 50%, transparent 50%);

            background-position: top left, top left;

            background-size: 10px 10px;

            background-repeat: repeat-x;

        }

        .dark .ticket-jagged-edge {

             background-image: linear-gradient(135deg, transparent 50%, #1e1e1e 50%), linear-gradient(45deg, #1e1e1e 50%, transparent 50%);

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display text-primary dark:text-gray-100 antialiased selection:bg-primary/20">

<!-- Mobile Container -->

<div class="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark">

<!-- Header -->

<header class="sticky top-0 z-30 flex items-center justify-between bg-surface-light/90 dark:bg-surface-dark/90 px-5 py-4 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">

<div class="flex flex-col">

<h1 class="text-2xl font-bold tracking-tight text-primary dark:text-white">Pending Orders</h1>

<p class="text-xs font-medium text-secondary dark:text-gray-400">Cameroon Bar POS • <span class="text-green-600 dark:text-green-400">Online</span></p>

</div>

<button class="relative flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-primary dark:text-white transition hover:bg-gray-200 dark:hover:bg-gray-700">

<span class="material-symbols-outlined text-[24px]">notifications</span>

<span class="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-danger border-2 border-white dark:border-gray-800"></span>

</button>

</header>

<!-- Stats / Quick View -->

<div class="px-5 py-4 grid grid-cols-2 gap-3">

<div class="bg-primary text-white rounded-xl p-3 shadow-lg flex flex-col justify-between h-20 relative overflow-hidden group">

<div class="absolute -right-4 -top-4 bg-white/10 w-16 h-16 rounded-full group-hover:scale-150 transition-transform duration-500"></div>

<span class="text-xs font-medium opacity-80 uppercase tracking-wider">Queue</span>

<div class="flex items-end gap-2 z-10">

<span class="text-3xl font-bold">12</span>

<span class="text-sm mb-1 opacity-80">orders</span>

</div>

</div>

<div class="bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm flex flex-col justify-between h-20">

<span class="text-xs font-bold text-secondary dark:text-gray-400 uppercase tracking-wider">Avg Wait</span>

<div class="flex items-end gap-2">

<span class="text-3xl font-bold text-primary dark:text-white">4m</span>

<span class="text-sm mb-1 text-green-600 font-medium">▼ 30s</span>

</div>

</div>

</div>

<!-- Scrollable Order List -->

<main class="flex-1 overflow-y-auto px-5 pb-24 space-y-5">

<!-- Order Card 1: Urgent -->

<article class="relative flex flex-col w-full rounded-xl bg-surface-light dark:bg-surface-dark shadow-card border-l-4 border-danger overflow-hidden">

<!-- Header -->

<div class="flex items-center justify-between p-4 pb-2">

<div class="flex items-center gap-3">

<div class="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-primary dark:text-white font-bold text-lg border border-gray-200 dark:border-gray-600">

                            04

                        </div>

<div class="flex flex-col">

<span class="text-xs text-secondary dark:text-gray-400 font-medium uppercase tracking-wide">Table</span>

<span class="text-sm font-bold text-primary dark:text-white">Waitress: Sarah M.</span>

</div>

</div>

<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-danger/10 text-danger border border-danger/20">

<span class="material-symbols-outlined text-[16px]">schedule</span>

<span class="text-xs font-bold">12m ago</span>

</div>

</div>

<!-- Divider -->

<div class="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent mx-4"></div>

<!-- Items List -->

<div class="p-4 pt-3 flex flex-col gap-3">

<!-- Item 1 -->

<div class="flex items-start justify-between group">

<div class="flex items-start gap-3">

<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-xs font-bold text-primary dark:text-white mt-0.5">2</span>

<div class="flex flex-col">

<span class="text-base font-medium text-primary dark:text-gray-100 leading-tight">Guinness Large</span>

<span class="text-xs text-secondary dark:text-gray-500">650ml • Cold</span>

</div>

</div>

<span class="text-sm font-semibold text-primary dark:text-gray-200">3,000 FCFA</span>

</div>

<!-- Item 2 (Low Stock) -->

<div class="flex items-start justify-between">

<div class="flex items-start gap-3">

<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-xs font-bold text-primary dark:text-white mt-0.5">1</span>

<div class="flex flex-col">

<span class="text-base font-medium text-primary dark:text-gray-100 leading-tight">Beaufort Light</span>

<div class="flex items-center gap-1 mt-1">

<span class="inline-flex items-center rounded bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 uppercase tracking-wide">

<span class="material-symbols-outlined text-[10px] mr-1">inventory_2</span> Low Stock

                                    </span>

</div>

</div>

</div>

<span class="text-sm font-semibold text-primary dark:text-gray-200">1,500 FCFA</span>

</div>

</div>

<!-- Footer Action -->

<div class="mt-auto bg-gray-50 dark:bg-gray-800/50 p-4 border-t border-gray-100 dark:border-gray-700">

<div class="flex items-center justify-between mb-4">

<span class="text-sm font-medium text-secondary dark:text-gray-400">Total Items: 3</span>

<div class="flex flex-col items-end">

<span class="text-xs text-secondary dark:text-gray-400">Total Amount</span>

<span class="text-xl font-bold text-primary dark:text-white tracking-tight">4,500 FCFA</span>

</div>

</div>

<button class="relative w-full overflow-hidden rounded-lg bg-primary hover:bg-[#12233a] dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-3.5 font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 group">

<span class="material-symbols-outlined text-[20px] group-hover:rotate-12 transition-transform">print</span>

<span>Validate &amp; Print</span>

<div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>

</button>

</div>

</article>

<!-- Order Card 2: Normal -->

<article class="relative flex flex-col w-full rounded-xl bg-surface-light dark:bg-surface-dark shadow-card border-l-4 border-green-500 overflow-hidden">

<div class="flex items-center justify-between p-4 pb-2">

<div class="flex items-center gap-3">

<div class="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-primary dark:text-white font-bold text-lg border border-gray-200 dark:border-gray-600">

                            12

                        </div>

<div class="flex flex-col">

<span class="text-xs text-secondary dark:text-gray-400 font-medium uppercase tracking-wide">Table</span>

<span class="text-sm font-bold text-primary dark:text-white">Waitress: Amadou J.</span>

</div>

</div>

<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800/30">

<span class="material-symbols-outlined text-[16px]">timer</span>

<span class="text-xs font-bold">2m ago</span>

</div>

</div>

<div class="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent mx-4"></div>

<div class="p-4 pt-3 flex flex-col gap-3">

<!-- Item 1 -->

<div class="flex items-start justify-between">

<div class="flex items-start gap-3">

<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-xs font-bold text-primary dark:text-white mt-0.5">1</span>

<div class="flex flex-col">

<span class="text-base font-medium text-primary dark:text-gray-100 leading-tight">Old Parr 12Y</span>

<span class="text-xs text-secondary dark:text-gray-500">Bottle</span>

</div>

</div>

<span class="text-sm font-semibold text-primary dark:text-gray-200">25,000 FCFA</span>

</div>

<!-- Item 2 -->

<div class="flex items-start justify-between">

<div class="flex items-start gap-3">

<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-xs font-bold text-primary dark:text-white mt-0.5">3</span>

<div class="flex flex-col">

<span class="text-base font-medium text-primary dark:text-gray-100 leading-tight">Coke Zero</span>

<span class="text-xs text-secondary dark:text-gray-500">Mixer</span>

</div>

</div>

<span class="text-sm font-semibold text-primary dark:text-gray-200">3,000 FCFA</span>

</div>

</div>

<div class="mt-auto bg-gray-50 dark:bg-gray-800/50 p-4 border-t border-gray-100 dark:border-gray-700">

<div class="flex items-center justify-between mb-4">

<span class="text-sm font-medium text-secondary dark:text-gray-400">Total Items: 4</span>

<div class="flex flex-col items-end">

<span class="text-xs text-secondary dark:text-gray-400">Total Amount</span>

<span class="text-xl font-bold text-primary dark:text-white tracking-tight">28,000 FCFA</span>

</div>

</div>

<button class="w-full overflow-hidden rounded-lg bg-primary hover:bg-[#12233a] dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-3.5 font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2">

<span class="material-symbols-outlined text-[20px]">print</span>

<span>Validate &amp; Print</span>

</button>

</div>

</article>

<!-- Order Card 3: Warning -->

<article class="relative flex flex-col w-full rounded-xl bg-surface-light dark:bg-surface-dark shadow-card border-l-4 border-warning overflow-hidden opacity-90 hover:opacity-100 transition-opacity">

<div class="flex items-center justify-between p-4 pb-2">

<div class="flex items-center gap-3">

<div class="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-primary dark:text-white font-bold text-lg border border-gray-200 dark:border-gray-600">

                            08

                        </div>

<div class="flex flex-col">

<span class="text-xs text-secondary dark:text-gray-400 font-medium uppercase tracking-wide">Table</span>

<span class="text-sm font-bold text-primary dark:text-white">Waitress: Chioma E.</span>

</div>

</div>

<div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-warning/10 text-warning border border-warning/20">

<span class="material-symbols-outlined text-[16px]">timelapse</span>

<span class="text-xs font-bold">6m ago</span>

</div>

</div>

<div class="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent mx-4"></div>

<div class="p-4 pt-3 flex flex-col gap-3">

<div class="flex items-start justify-between">

<div class="flex items-start gap-3">

<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-xs font-bold text-primary dark:text-white mt-0.5">2</span>

<div class="flex flex-col">

<span class="text-base font-medium text-primary dark:text-gray-100 leading-tight">Roasted Fish (Bar)</span>

<span class="text-xs text-secondary dark:text-gray-500">Spicy • Medium</span>

</div>

</div>

<span class="text-sm font-semibold text-primary dark:text-gray-200">6,000 FCFA</span>

</div>

<div class="flex items-start justify-between">

<div class="flex items-start gap-3">

<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-xs font-bold text-primary dark:text-white mt-0.5">2</span>

<div class="flex flex-col">

<span class="text-base font-medium text-primary dark:text-gray-100 leading-tight">Plantains</span>

<span class="text-xs text-secondary dark:text-gray-500">Side dish</span>

</div>

</div>

<span class="text-sm font-semibold text-primary dark:text-gray-200">1,000 FCFA</span>

</div>

</div>

<div class="mt-auto bg-gray-50 dark:bg-gray-800/50 p-4 border-t border-gray-100 dark:border-gray-700">

<div class="flex items-center justify-between mb-4">

<span class="text-sm font-medium text-secondary dark:text-gray-400">Total Items: 4</span>

<div class="flex flex-col items-end">

<span class="text-xs text-secondary dark:text-gray-400">Total Amount</span>

<span class="text-xl font-bold text-primary dark:text-white tracking-tight">7,000 FCFA</span>

</div>

</div>

<button class="w-full overflow-hidden rounded-lg bg-primary hover:bg-[#12233a] dark:bg-blue-600 dark:hover:bg-blue-700 text-white py-3.5 font-bold shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2">

<span class="material-symbols-outlined text-[20px]">print</span>

<span>Validate &amp; Print</span>

</button>

</div>

</article>

</main>

<!-- Floating Action Button for manual entry (Contextual Surprise) -->

<button class="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-white shadow-float flex items-center justify-center hover:bg-[#12233a] dark:bg-white dark:text-primary dark:hover:bg-gray-200 transition-all active:scale-90 z-40">

<span class="material-symbols-outlined text-[28px]">add</span>

</button>

</div>

</body></html>

<!-- Product Details Editor -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Add Product - Bar Management</title>

<!-- Fonts -->

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&amp;display=swap" rel="stylesheet"/>

<!-- Material Symbols -->

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<!-- Tailwind CSS -->

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Tailwind Config -->

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#0d6273",

                        "background-light": "#f9fafa",

                        "background-dark": "#121416",

                        "surface-dark": "#1F2427", // From plan

                        "text-muted": "#9EA8AC", // From plan

                        "text-light": "#E0E5E7", // From plan

                    },

                    fontFamily: {

                        "display": ["Manrope", "sans-serif"]

                    },

                    borderRadius: {

                        "DEFAULT": "0.125rem", // 2px

                        "sm": "0.25rem",       // 4px (Plan requirement)

                        "lg": "0.5rem",        // 8px

                        "xl": "0.75rem",       // 12px

                        "full": "9999px"

                    },

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar for dark mode webkit */

        ::-webkit-scrollbar {

            width: 6px;

        }

        ::-webkit-scrollbar-track {

            background: #0E1112; 

        }

        ::-webkit-scrollbar-thumb {

            background: #2A3034; 

            border-radius: 3px;

        }

        /* Remove default arrow from select */

        select {

            -webkit-appearance: none;

            -moz-appearance: none;

            appearance: none;

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-[#0E1112] font-display antialiased text-gray-900 dark:text-text-light selection:bg-primary selection:text-white pb-24">

<!-- Top Navigation Bar -->

<header class="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-background-light/95 dark:bg-[#0E1112]/95 backdrop-blur-sm border-b border-gray-200 dark:border-white/5">

<button aria-label="Close" class="flex items-center justify-center size-10 rounded-full text-gray-500 dark:text-text-light hover:bg-gray-200 dark:hover:bg-white/5 transition-colors">

<span class="material-symbols-outlined text-2xl">close</span>

</button>

<h1 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">Add Product</h1>

<div class="size-10"></div> <!-- Spacer for balance -->

</header>

<!-- Main Content Form -->

<main class="w-full max-w-md mx-auto p-5 flex flex-col gap-8">

<!-- Hero Visual / Context -->

<div class="relative w-full h-32 rounded-lg overflow-hidden mb-2 group">

<img alt="Abstract close up of dark amber liquid with bubbles representing beer or whiskey in a glass" class="w-full h-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105" data-alt="Abstract close up of dark amber liquid with bubbles representing beer or whiskey in a glass" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTM_kYAO8pto8jjmkOXKzBLzmw8ueh7KcuNPo-5cZLRD3egLsb-YIbZsPyk5wDglePdW2eVkjBhzMkIf6PPs_UysPjJ3DR_Jn-Q97ypZVSLBONkSaD2dlZSchn4GDxwL0a1KO9nTT6RIoyPq012EiYtksmcmIoWbJ7NBlmN6uCMpKFuhjZ4S71OMmOjZTAnmVUoIJlLjtKBDpaK4hpe3ADTvqXgqbzMOHq8Ffj4xTMuYdQyeMqgwVWSCvn9fAy9eceNBWekSdnON-O"/>

<div class="absolute inset-0 bg-gradient-to-t from-[#0E1112] to-transparent"></div>

<div class="absolute bottom-3 left-4">

<p class="text-xs font-semibold text-primary uppercase tracking-widest mb-1">New Inventory Item</p>

<p class="text-sm text-text-muted">Enter details below to track stock.</p>

</div>

</div>

<!-- Section 1: Identification -->

<section class="flex flex-col gap-5">

<div class="flex items-center gap-2 mb-1">

<span class="material-symbols-outlined text-primary text-sm">badge</span>

<h3 class="text-xs font-bold uppercase tracking-widest text-text-muted">Identification</h3>

</div>

<!-- Product Name Field -->

<div class="group">

<label class="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide" for="product_name">Product Name</label>

<div class="relative">

<input class="w-full bg-gray-100 dark:bg-surface-dark text-gray-900 dark:text-text-light h-14 px-4 rounded-sm border-0 focus:ring-1 focus:ring-primary placeholder-gray-400 dark:placeholder-text-muted/50 transition-all text-base shadow-sm" id="product_name" placeholder="e.g., Guinness Small Model" type="text"/>

</div>

</div>

<!-- Category Select -->

<div class="group">

<label class="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide" for="category">Category</label>

<div class="relative">

<select class="w-full bg-gray-100 dark:bg-surface-dark text-gray-900 dark:text-text-light h-14 px-4 pr-10 rounded-sm border-0 focus:ring-1 focus:ring-primary transition-all text-base shadow-sm appearance-none cursor-pointer" id="category">

<option disabled="" selected="" value="">Select Category</option>

<option value="beer">Beers &amp; Ciders</option>

<option value="spirit">Spirits &amp; Liquors</option>

<option value="wine">Wines</option>

<option value="soft">Soft Drinks</option>

<option value="water">Water</option>

<option value="tobacco">Tobacco</option>

</select>

<div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">

<span class="material-symbols-outlined">expand_more</span>

</div>

</div>

</div>

</section>

<hr class="border-gray-200 dark:border-white/5"/>

<!-- Section 2: Pricing & Inventory -->

<section class="flex flex-col gap-5">

<div class="flex items-center gap-2 mb-1">

<span class="material-symbols-outlined text-primary text-sm">payments</span>

<h3 class="text-xs font-bold uppercase tracking-widest text-text-muted">Pricing &amp; Inventory</h3>

</div>

<!-- Sales Price -->

<div class="group">

<label class="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wide" for="price">Sales Price (XAF)</label>

<div class="relative">

<input class="w-full bg-gray-100 dark:bg-surface-dark text-gray-900 dark:text-text-light h-14 pl-4 pr-12 rounded-sm border-0 focus:ring-1 focus:ring-primary placeholder-gray-400 dark:placeholder-text-muted/50 transition-all text-base shadow-sm font-mono" id="price" inputmode="numeric" placeholder="0" type="text"/>

<div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-sm font-bold">

                        FCFA

                    </div>

</div>

</div>

<!-- Low Stock Threshold -->

<div class="group">

<div class="flex justify-between items-baseline mb-2">

<label class="block text-xs font-semibold text-text-muted uppercase tracking-wide" for="threshold">Low Stock Alert</label>

<span class="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full">Auto-Alert</span>

</div>

<div class="relative">

<input class="w-full bg-gray-100 dark:bg-surface-dark text-gray-900 dark:text-text-light h-14 px-4 rounded-sm border-0 focus:ring-1 focus:ring-primary placeholder-gray-400 dark:placeholder-text-muted/50 transition-all text-base shadow-sm font-mono" id="threshold" inputmode="numeric" type="number" value="10"/>

<div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">

<span class="material-symbols-outlined text-lg">notifications_active</span>

</div>

</div>

<p class="mt-2 text-xs text-text-muted leading-relaxed">

                    System will notify managers when stock count drops below this number to prevent theft or outages.

                </p>

</div>

</section>

</main>

<!-- Sticky Bottom Action Bar -->

<div class="fixed bottom-0 left-0 w-full bg-white/80 dark:bg-[#0E1112]/80 backdrop-blur-xl border-t border-gray-200 dark:border-white/5 p-4 z-40 safe-area-bottom">

<div class="max-w-md mx-auto">

<button class="w-full h-14 bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all rounded-sm text-white font-bold text-lg shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group">

<span class="material-symbols-outlined group-hover:rotate-12 transition-transform">save</span>

                Save Product

            </button>

</div>

</div>

<!-- Background decoration -->

<div class="fixed top-0 left-0 w-full h-full pointer-events-none z-[-1] overflow-hidden">

<div class="absolute -top-[20%] -right-[20%] w-[50%] h-[50%] rounded-full bg-primary/5 blur-[100px]"></div>

<div class="absolute top-[40%] -left-[10%] w-[30%] h-[30%] rounded-full bg-primary/5 blur-[80px]"></div>

</div>

</body></html>

<!-- Record New Supply Arrival -->

<!DOCTYPE html>

<html class="light"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Record New Supply Arrival</title>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

      tailwind.config = {

        darkMode: "class",

        theme: {

          extend: {

            colors: {

              "primary": "#1776ba",

              "primary-dark": "#105a8f",

              "background-light": "#f0f2f4",

              "background-dark": "#1a1d23",

              "card-light": "#ffffff",

              "card-dark": "#252a33",

              "border-light": "#e2e8f0",

              "border-dark": "#343b45",

            },

            fontFamily: {

              "display": ["Manrope", "sans-serif"]

            },

            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},

          },

        },

      }

    </script>

<style>

        /* Custom scrollbar for better feel on desktop testing, though irrelevant for phone */

        ::-webkit-scrollbar { width: 6px; }

        ::-webkit-scrollbar-track { background: transparent; }

        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        .dark ::-webkit-scrollbar-thumb { background: #475569; }

        

        /* Remove number input spinner */

        input[type=number]::-webkit-inner-spin-button, 

        input[type=number]::-webkit-outer-spin-button { 

            -webkit-appearance: none; 

            margin: 0; 

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden min-h-screen flex flex-col">

<!-- Top Navigation Bar -->

<header class="sticky top-0 z-40 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark transition-colors duration-300">

<div class="flex items-center justify-between px-4 h-[60px]">

<button aria-label="Go back" class="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors group">

<span class="material-symbols-outlined group-hover:-translate-x-0.5 transition-transform">arrow_back</span>

</button>

<h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">Record New Supply Arrival</h1>

<div class="w-8"></div> <!-- Spacer for optical centering -->

</div>

</header>

<!-- Main Form Content -->

<main class="flex-1 px-4 py-6 space-y-6 pb-32">

<!-- Section: Logistics -->

<div class="space-y-3">

<h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 ml-1">Logistics</h2>

<div class="bg-card-light dark:bg-card-dark rounded-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-border-light dark:border-border-dark p-4 space-y-5">

<!-- Supplier Dropdown -->

<div class="space-y-2">

<label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Supplier</label>

<div class="relative group">

<select class="w-full h-14 pl-4 pr-10 bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none cursor-pointer">

<option disabled="" selected="" value="">Select a supplier...</option>

<option value="sabc">SABC (Brasseries du Cameroun)</option>

<option value="guinness">Guinness Cameroon</option>

<option value="ucb">UCB (Union Camerounaise de Brasseries)</option>

<option value="source">Source du Pays</option>

</select>

<div class="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-primary transition-colors">

<span class="material-symbols-outlined">expand_more</span>

</div>

</div>

</div>

<!-- Date and Invoice Row -->

<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

<div class="space-y-2">

<label class="block text-sm font-medium text-slate-700 dark:text-slate-300">Date Received</label>

<div class="relative">

<input class="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400" type="date"/>

</div>

</div>

<div class="space-y-2">

<label class="block text-sm font-medium text-slate-700 dark:text-slate-300">

                            Invoice # <span class="text-slate-400 font-normal text-xs ml-1">(Optional)</span>

</label>

<input class="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-slate-400" placeholder="e.g. INV-2023-001" type="text"/>

</div>

</div>

</div>

</div>

<!-- Section: Inventory Items -->

<div class="space-y-4">

<div class="flex items-center justify-between ml-1">

<h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Stock Items</h2>

<div class="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">2 Items Added</div>

</div>

<!-- Item Card 1 -->

<div class="group relative bg-card-light dark:bg-card-dark rounded-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-border-light dark:border-border-dark p-4 transition-all hover:border-primary/50">

<!-- Delete Action -->

<button aria-label="Remove item" class="absolute -top-3 -right-2 p-2 bg-white dark:bg-card-dark text-red-500 hover:text-red-600 rounded-full shadow-sm border border-red-100 dark:border-red-900/30 transition-transform hover:scale-110 z-10">

<span class="material-symbols-outlined text-[20px]">delete</span>

</button>

<div class="grid gap-4">

<!-- Product Search/Select -->

<div class="space-y-2">

<label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Product</label>

<div class="relative">

<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>

<input class="w-full h-14 pl-12 pr-4 bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-base font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" type="text" value="Castel Beer 65cl"/>

</div>

</div>

<div class="grid grid-cols-2 gap-4">

<!-- Quantity -->

<div class="space-y-2">

<label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Qty (Crates)</label>

<div class="relative flex items-center">

<button class="absolute left-1 w-10 h-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-colors">

<span class="material-symbols-outlined text-[20px]">remove</span>

</button>

<input class="w-full h-14 px-12 text-center bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" type="number" value="50"/>

<button class="absolute right-1 w-10 h-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-colors">

<span class="material-symbols-outlined text-[20px]">add</span>

</button>

</div>

</div>

<!-- Unit Cost -->

<div class="space-y-2">

<label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Unit Cost</label>

<div class="relative">

<input class="w-full h-14 pl-4 pr-14 bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-right" type="number" value="4200"/>

<span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400 pointer-events-none">FCFA</span>

</div>

</div>

</div>

<!-- Row Total -->

<div class="pt-3 mt-1 border-t border-dashed border-border-light dark:border-border-dark flex justify-between items-center">

<span class="text-sm font-medium text-slate-500">Subtotal</span>

<span class="text-base font-bold text-slate-800 dark:text-slate-200">210,000 FCFA</span>

</div>

</div>

</div>

<!-- Item Card 2 -->

<div class="group relative bg-card-light dark:bg-card-dark rounded-lg shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-border-light dark:border-border-dark p-4 transition-all hover:border-primary/50">

<button aria-label="Remove item" class="absolute -top-3 -right-2 p-2 bg-white dark:bg-card-dark text-red-500 hover:text-red-600 rounded-full shadow-sm border border-red-100 dark:border-red-900/30 transition-transform hover:scale-110 z-10">

<span class="material-symbols-outlined text-[20px]">delete</span>

</button>

<div class="grid gap-4">

<div class="space-y-2">

<label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Product</label>

<div class="relative">

<span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>

<input class="w-full h-14 pl-12 pr-4 bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-base font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" type="text" value="Beaufort Light"/>

</div>

</div>

<div class="grid grid-cols-2 gap-4">

<div class="space-y-2">

<label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Qty (Crates)</label>

<div class="relative flex items-center">

<button class="absolute left-1 w-10 h-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-colors">

<span class="material-symbols-outlined text-[20px]">remove</span>

</button>

<input class="w-full h-14 px-12 text-center bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" type="number" value="20"/>

<button class="absolute right-1 w-10 h-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded-lg transition-colors">

<span class="material-symbols-outlined text-[20px]">add</span>

</button>

</div>

</div>

<div class="space-y-2">

<label class="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tracking-wide">Unit Cost</label>

<div class="relative">

<input class="w-full h-14 pl-4 pr-14 bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-lg font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-right" type="number" value="4500"/>

<span class="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 dark:text-slate-400 pointer-events-none">FCFA</span>

</div>

</div>

</div>

<div class="pt-3 mt-1 border-t border-dashed border-border-light dark:border-border-dark flex justify-between items-center">

<span class="text-sm font-medium text-slate-500">Subtotal</span>

<span class="text-base font-bold text-slate-800 dark:text-slate-200">90,000 FCFA</span>

</div>

</div>

</div>

<!-- Add Product Button -->

<button class="w-full h-14 flex items-center justify-center space-x-2 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/30 hover:border-primary text-slate-500 dark:text-slate-400 hover:text-primary transition-all group">

<div class="bg-slate-200 dark:bg-slate-700 rounded-full p-1 group-hover:bg-primary group-hover:text-white transition-colors">

<span class="material-symbols-outlined text-[20px]">add</span>

</div>

<span class="font-bold text-sm">Add Another Product</span>

</button>

</div>

<!-- Summary Totals -->

<div class="pt-2">

<div class="bg-slate-800 dark:bg-black rounded-lg p-5 text-white shadow-xl relative overflow-hidden">

<!-- Abstract pattern decoration -->

<div class="absolute -right-10 -top-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>

<div class="relative z-10 flex flex-col space-y-4">

<div class="flex justify-between items-center border-b border-white/10 pb-3">

<span class="text-slate-300 text-sm font-medium uppercase tracking-wider">Total Items</span>

<span class="text-white font-bold text-lg">70</span>

</div>

<div class="flex justify-between items-end">

<span class="text-slate-300 text-sm font-medium uppercase tracking-wider mb-1">Total Cost</span>

<div class="text-right">

<div class="text-3xl font-extrabold text-white tracking-tight">300,000</div>

<div class="text-sm font-medium text-primary/80 dark:text-primary-300 text-right">FCFA</div>

</div>

</div>

</div>

</div>

</div>

</main>

<!-- Bottom Sticky Action Button -->

<div class="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-card-dark/95 backdrop-blur-md border-t border-border-light dark:border-border-dark z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">

<button class="w-full bg-primary hover:bg-primary-dark text-white font-bold h-14 rounded-lg shadow-lg shadow-primary/30 flex items-center justify-center gap-3 transition-transform active:scale-[0.98]">

<span>Submit Supply</span>

<span class="material-symbols-outlined">arrow_forward</span>

</button>

</div>

</body></html>

<!-- Table Management Grid -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Waitress App - Table Selection (Dark Mode)</title>

<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;family=Noto+Sans:wght@400;500;700&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        // Custom Dark Palette based on request

                        "app-bg": "#121212",      // Deep charcoal

                        "app-card": "#1E1E1E",    // Slightly lighter grey for depth

                        "app-border": "#2A2A2A",  // Subtle border

                        // Accessible Status Colors for Dark Mode

                        // Lighter shades (300/400 range) for text to ensure contrast against dark bg

                        "status-free-text": "#6EE7B7",    // Emerald 300

                        "status-free-bg": "rgba(16, 185, 129, 0.15)",

                        "status-free-border": "rgba(16, 185, 129, 0.3)",

                        "status-pending-text": "#FCD34D", // Amber 300

                        "status-pending-bg": "rgba(245, 158, 11, 0.15)",

                        "status-pending-border": "rgba(245, 158, 11, 0.3)",

                        "status-occupied-text": "#93C5FD", // Blue 300

                        "status-occupied-bg": "rgba(59, 130, 246, 0.15)",

                        "status-occupied-border": "rgba(59, 130, 246, 0.3)",

                    },

                    fontFamily: {

                        "display": ["Plus Jakarta Sans", "sans-serif"],

                        "body": ["Noto Sans", "sans-serif"],

                    },

                    boxShadow: {

                        "card": "0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)",

                        "glow": "0 0 15px rgba(255, 255, 255, 0.05)",

                    }

                },

            },

        }

    </script>

<style>

        .no-scrollbar::-webkit-scrollbar {

            display: none;

        }

        .no-scrollbar {

            -ms-overflow-style: none;

            scrollbar-width: none;

        }

        body {

            min-height: max(884px, 100dvh);

            background-color: #121212;}

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-app-bg text-white font-display antialiased selection:bg-white selection:text-black">

<div class="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto bg-app-bg border-x border-app-border shadow-2xl overflow-hidden">

<header class="sticky top-0 z-10 bg-app-bg/95 backdrop-blur-md border-b border-app-border px-4 py-3 flex items-center justify-between transition-colors">

<div class="flex items-center gap-3">

<div class="relative">

<div class="size-10 rounded-full bg-neutral-800 bg-cover bg-center border border-neutral-700" data-alt="Profile picture of the waitress" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCE_jAQzTRom-wzxGapWaCjeEfhewIJjS0xPN4N3Y1bSb50_qWY9siNlFSikLvgxZYf9UZN6-CNilzELwkXzxuyGpD_pQg5-p5sJjMQCqbCo_rS-KBVWcRokjmW7dJfDRvBu42KCCNFPK3FE2rbmWNikNs9tg6j77VVYWamzqLoVz-qTj3WV_9JD_jRLk4ylvvJw0y4JA2XU27M4iS5vwUqb8hbRBz66I8mOSk5Y-x-l7AHkTAvP6cwmNMqI2ppPFUWlSaGmZt7CYYm");'>

</div>

<div class="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full border-2 border-app-bg"></div>

</div>

<div>

<h1 class="text-lg font-bold leading-none text-white">Floor Plan</h1>

<span class="text-xs text-neutral-400 font-medium">Shift: Evening</span>

</div>

</div>

<button class="flex items-center justify-center size-10 rounded-full hover:bg-neutral-800 text-white transition-colors relative">

<span class="material-symbols-outlined text-[24px]">notifications</span>

<span class="absolute top-2 right-2 size-2 bg-red-500 rounded-full"></span>

</button>

</header>

<div class="px-4 py-4 space-y-4">

<div class="relative group">

<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">

<span class="material-symbols-outlined text-neutral-500 group-focus-within:text-white transition-colors">search</span>

</div>

<input class="block w-full pl-10 pr-3 py-3 border border-app-border rounded-lg leading-5 bg-app-card text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-600 focus:border-transparent sm:text-sm transition-all shadow-sm" placeholder="Search table number or customer..." type="text"/>

</div>

<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">

<button class="flex-shrink-0 px-4 py-2 bg-white text-black text-sm font-bold rounded-lg shadow-sm border border-transparent transition-transform active:scale-95">

                Main Hall

            </button>

<button class="flex-shrink-0 px-4 py-2 bg-app-card text-neutral-400 text-sm font-medium rounded-lg border border-app-border hover:bg-neutral-800 hover:text-white transition-colors">

                Terrace

            </button>

<button class="flex-shrink-0 px-4 py-2 bg-app-card text-neutral-400 text-sm font-medium rounded-lg border border-app-border hover:bg-neutral-800 hover:text-white transition-colors">

                VIP Section

            </button>

<button class="flex-shrink-0 px-4 py-2 bg-app-card text-neutral-400 text-sm font-medium rounded-lg border border-app-border hover:bg-neutral-800 hover:text-white transition-colors">

                Bar

            </button>

</div>

</div>

<main class="flex-1 px-4 pb-20 overflow-y-auto no-scrollbar">

<div class="flex items-center justify-between mb-4">

<h2 class="text-xl font-bold tracking-tight text-white">Main Hall Tables</h2>

<span class="text-xs font-semibold text-neutral-500 uppercase tracking-wider">12 Tables</span>

</div>

<div class="grid grid-cols-2 gap-4">

<div class="group relative flex flex-col justify-between p-4 bg-app-card border border-app-border rounded-lg h-36 shadow-card hover:border-emerald-500/50 transition-colors cursor-pointer">

<div class="absolute left-0 top-4 bottom-4 w-1 bg-emerald-500 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>

<div class="flex justify-between items-start pl-3">

<span class="text-3xl font-extrabold text-white tracking-tight">T-01</span>

<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-status-free-bg text-status-free-text border border-status-free-border">

                        FREE

                    </span>

</div>

<div class="pl-3 mt-auto">

<div class="flex items-center gap-1.5 text-neutral-400">

<span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">chair</span>

<span class="text-sm font-medium">4 Seats</span>

</div>

</div>

</div>

<div class="group relative flex flex-col justify-between p-4 bg-app-card border border-app-border rounded-lg h-36 shadow-card hover:border-amber-500/50 transition-colors cursor-pointer ring-1 ring-transparent hover:ring-amber-500/10">

<div class="absolute left-0 top-4 bottom-4 w-1 bg-amber-500 rounded-r-full shadow-[0_0_10px_rgba(245,158,11,0.3)]"></div>

<div class="flex justify-between items-start pl-3">

<span class="text-3xl font-extrabold text-white tracking-tight">T-02</span>

<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-status-pending-bg text-status-pending-text border border-status-pending-border">

                        PENDING

                    </span>

</div>

<div class="pl-3 mt-auto">

<div class="flex items-center gap-1.5 text-amber-400 animate-pulse">

<span class="material-symbols-outlined text-lg">timer</span>

<span class="text-sm font-bold font-mono">05:23</span>

</div>

</div>

</div>

<div class="group relative flex flex-col justify-between p-4 bg-app-card border border-app-border rounded-lg h-36 shadow-card hover:border-blue-500/50 transition-colors cursor-pointer">

<div class="absolute left-0 top-4 bottom-4 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"></div>

<div class="flex justify-between items-start pl-3">

<span class="text-3xl font-extrabold text-white tracking-tight">T-03</span>

<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-status-occupied-bg text-status-occupied-text border border-status-occupied-border">

                        BUSY

                    </span>

</div>

<div class="pl-3 mt-auto">

<div class="flex flex-col gap-0.5">

<span class="text-[10px] text-neutral-500 font-semibold uppercase">Current Bill</span>

<span class="text-sm font-bold text-white font-mono">12,500 XAF</span>

</div>

</div>

</div>

<div class="group relative flex flex-col justify-between p-4 bg-app-card border border-app-border rounded-lg h-36 shadow-card hover:border-emerald-500/50 transition-colors cursor-pointer">

<div class="absolute left-0 top-4 bottom-4 w-1 bg-emerald-500 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>

<div class="flex justify-between items-start pl-3">

<span class="text-3xl font-extrabold text-white tracking-tight">T-04</span>

<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-status-free-bg text-status-free-text border border-status-free-border">

                        FREE

                    </span>

</div>

<div class="pl-3 mt-auto">

<div class="flex items-center gap-1.5 text-neutral-400">

<span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">chair</span>

<span class="text-sm font-medium">2 Seats</span>

</div>

</div>

</div>

<div class="group relative flex flex-col justify-between p-4 bg-app-card border border-app-border rounded-lg h-36 shadow-card hover:border-blue-500/50 transition-colors cursor-pointer">

<div class="absolute left-0 top-4 bottom-4 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.3)]"></div>

<div class="flex justify-between items-start pl-3">

<span class="text-3xl font-extrabold text-white tracking-tight">T-05</span>

<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-status-occupied-bg text-status-occupied-text border border-status-occupied-border">

                        BUSY

                    </span>

</div>

<div class="pl-3 mt-auto">

<div class="flex flex-col gap-0.5">

<span class="text-[10px] text-neutral-500 font-semibold uppercase">Current Bill</span>

<span class="text-sm font-bold text-white font-mono">4,200 XAF</span>

</div>

</div>

</div>

<div class="group relative flex flex-col justify-between p-4 bg-app-card border border-app-border rounded-lg h-36 shadow-card hover:border-emerald-500/50 transition-colors cursor-pointer">

<div class="absolute left-0 top-4 bottom-4 w-1 bg-emerald-500 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>

<div class="flex justify-between items-start pl-3">

<span class="text-3xl font-extrabold text-white tracking-tight">T-06</span>

<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-status-free-bg text-status-free-text border border-status-free-border">

                        FREE

                    </span>

</div>

<div class="pl-3 mt-auto">

<div class="flex items-center gap-1.5 text-neutral-400">

<span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">chair</span>

<span class="text-sm font-medium">6 Seats</span>

</div>

</div>

</div>

</div>

<div class="h-6"></div>

</main>

<div class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-30">

<button class="flex items-center gap-2 bg-white text-black pl-5 pr-6 py-3 rounded-full shadow-xl shadow-black/50 hover:bg-neutral-200 transition-all active:scale-95">

<span class="material-symbols-outlined">add</span>

<span class="font-bold text-sm">New Walk-in</span>

</button>

<button class="flex items-center justify-center size-12 bg-app-card text-white rounded-full shadow-lg border border-app-border hover:bg-neutral-800 transition-all active:scale-95">

<span class="material-symbols-outlined">receipt_long</span>

</button>

</div>

</div>

</body></html>

<!-- Stock Supply History Detail -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Stock Supply History</title>

<!-- Fonts -->

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&amp;display=swap" rel="stylesheet"/>

<!-- Material Symbols -->

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<!-- Tailwind CSS -->

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#1d8ea5",

                        "primary-dark": "#156a7b",

                        "background-light": "#f6f8f8",

                        "background-dark": "#121e20",

                        "surface-dark": "#1A2628",

                        "surface-light": "#ffffff",

                    },

                    fontFamily: {

                        "display": ["Manrope", "sans-serif"]

                    },

                    borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "9999px"},

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar hiding for cleaner mobile look */

        .no-scrollbar::-webkit-scrollbar {

            display: none;

        }

        .no-scrollbar {

            -ms-overflow-style: none;

            scrollbar-width: none;

        }

        

        /* Accordion transition logic */

        details > summary {

            list-style: none;

        }

        details > summary::-webkit-details-marker {

            display: none;

        }

        details[open] summary ~ * {

            animation: sweep .3s ease-in-out;

        }

        @keyframes sweep {

            0%    {opacity: 0; transform: translateY(-10px)}

            100%  {opacity: 1; transform: translateY(0)}

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen flex justify-center overflow-x-hidden">

<!-- Mobile Container -->

<div class="w-full max-w-md relative flex flex-col min-h-screen bg-background-light dark:bg-background-dark shadow-2xl">

<!-- Top App Bar -->

<header class="sticky top-0 z-50 bg-background-light dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-white/5 px-4 pt-12 pb-4">

<div class="flex items-center justify-between gap-4">

<button class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">

<span class="material-symbols-outlined">arrow_back_ios_new</span>

</button>

<h1 class="text-lg font-bold leading-tight tracking-tight flex-1 text-center text-slate-900 dark:text-white">

                    Supply History

                </h1>

<button class="flex items-center justify-center w-10 h-10 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white">

<span class="material-symbols-outlined">tune</span>

</button>

</div>

<!-- Segmented Control / Date Filter -->

<div class="mt-4">

<div class="flex h-10 w-full items-center justify-center rounded-lg bg-gray-200 dark:bg-surface-dark p-1">

<label class="group flex-1 h-full relative cursor-pointer">

<input class="peer sr-only" name="date-filter" type="radio" value="Day"/>

<span class="flex h-full w-full items-center justify-center rounded text-sm font-semibold text-gray-500 dark:text-gray-400 peer-checked:bg-primary peer-checked:text-white transition-all duration-200 z-10 relative">Day</span>

</label>

<label class="group flex-1 h-full relative cursor-pointer">

<input class="peer sr-only" name="date-filter" type="radio" value="Week"/>

<span class="flex h-full w-full items-center justify-center rounded text-sm font-semibold text-gray-500 dark:text-gray-400 peer-checked:bg-primary peer-checked:text-white transition-all duration-200 z-10 relative">Week</span>

</label>

<label class="group flex-1 h-full relative cursor-pointer">

<input checked="" class="peer sr-only" name="date-filter" type="radio" value="Month"/>

<span class="flex h-full w-full items-center justify-center rounded text-sm font-semibold text-gray-500 dark:text-gray-400 peer-checked:bg-primary peer-checked:text-white transition-all duration-200 z-10 relative">Month</span>

</label>

<label class="group flex-1 h-full relative cursor-pointer">

<input class="peer sr-only" name="date-filter" type="radio" value="Custom"/>

<span class="flex h-full w-full items-center justify-center rounded text-sm font-semibold text-gray-500 dark:text-gray-400 peer-checked:bg-primary peer-checked:text-white transition-all duration-200 z-10 relative">Custom</span>

</label>

</div>

</div>

</header>

<!-- Main Content -->

<main class="flex-1 px-4 py-6 space-y-6 pb-24">

<!-- Summary Stats Card -->

<div class="relative overflow-hidden rounded-xl bg-surface-light dark:bg-gradient-to-br dark:from-surface-dark dark:to-[#151f22] p-6 border border-gray-200 dark:border-white/5 shadow-sm">

<div class="absolute top-0 right-0 p-4 opacity-10">

<span class="material-symbols-outlined text-6xl text-primary">payments</span>

</div>

<div class="relative z-10 flex flex-col gap-1">

<p class="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Spend (Month)</p>

<div class="flex items-baseline gap-2 mt-1">

<h2 class="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">2,450,000</h2>

<span class="text-lg font-bold text-gray-400">FCFA</span>

</div>

<div class="flex items-center gap-2 mt-2">

<span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">

<span class="material-symbols-outlined text-[14px]">trending_up</span>

                            +12%

                        </span>

<span class="text-xs text-gray-400">vs last month</span>

</div>

</div>

</div>

<!-- Supply List -->

<div class="space-y-4">

<div class="flex items-center justify-between px-1">

<h3 class="text-sm font-bold text-gray-400 uppercase tracking-wide">Recent Deliveries</h3>

<span class="text-xs text-primary font-medium cursor-pointer">Download Report</span>

</div>

<!-- Card 1: Expanded -->

<details class="group rounded-lg border border-gray-200 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm transition-all duration-300" open="">

<summary class="flex flex-col gap-3 p-4 cursor-pointer select-none bg-surface-light dark:bg-surface-dark transition-colors hover:bg-gray-50 dark:hover:bg-white/5">

<div class="flex items-start justify-between w-full">

<div class="flex flex-col">

<span class="text-base font-bold text-slate-900 dark:text-white">Brasseries du Cameroun</span>

<span class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Oct 12, 14:30</span>

</div>

<div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 group-open:bg-primary/20 group-open:rotate-180 transition-all">

<span class="material-symbols-outlined text-gray-500 dark:text-gray-400 group-open:text-primary text-xl">expand_more</span>

</div>

</div>

<div class="flex items-center justify-between w-full pt-1">

<div class="flex items-center gap-2">

<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">240 Items</span>

</div>

<span class="text-base font-bold text-primary dark:text-primary">1,250,000 FCFA</span>

</div>

</summary>

<div class="border-t border-dashed border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-[#151f22] p-4">

<div class="flex flex-col gap-3">

<!-- Header Row for items -->

<div class="flex text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">

<span class="flex-1">Product</span>

<span class="w-20 text-right">Qty</span>

<span class="w-24 text-right">Unit Price</span>

</div>

<!-- Item Row 1 -->

<div class="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-white/5 last:border-0">

<div class="flex-1 pr-2">

<p class="font-medium text-slate-800 dark:text-gray-200">33 Export (65cl)</p>

<p class="text-xs text-gray-400">100 crates</p>

</div>

<div class="w-20 text-right text-slate-600 dark:text-gray-400">x100</div>

<div class="w-24 text-right font-medium text-slate-800 dark:text-gray-300">5,200</div>

</div>

<!-- Item Row 2 -->

<div class="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-white/5 last:border-0">

<div class="flex-1 pr-2">

<p class="font-medium text-slate-800 dark:text-gray-200">Castel Beer</p>

<p class="text-xs text-gray-400">50 crates</p>

</div>

<div class="w-20 text-right text-slate-600 dark:text-gray-400">x50</div>

<div class="w-24 text-right font-medium text-slate-800 dark:text-gray-300">5,000</div>

</div>

<!-- Item Row 3 -->

<div class="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-white/5 last:border-0">

<div class="flex-1 pr-2">

<p class="font-medium text-slate-800 dark:text-gray-200">Mutzig (65cl)</p>

<p class="text-xs text-gray-400">90 crates</p>

</div>

<div class="w-20 text-right text-slate-600 dark:text-gray-400">x90</div>

<div class="w-24 text-right font-medium text-slate-800 dark:text-gray-300">5,100</div>

</div>

</div>

</div>

</details>

<!-- Card 2: Collapsed -->

<details class="group rounded-lg border border-gray-200 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm transition-all duration-300">

<summary class="flex flex-col gap-3 p-4 cursor-pointer select-none bg-surface-light dark:bg-surface-dark transition-colors hover:bg-gray-50 dark:hover:bg-white/5">

<div class="flex items-start justify-between w-full">

<div class="flex flex-col">

<span class="text-base font-bold text-slate-900 dark:text-white">Guinness SA</span>

<span class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Oct 10, 09:15</span>

</div>

<div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 group-open:bg-primary/20 group-open:rotate-180 transition-all">

<span class="material-symbols-outlined text-gray-500 dark:text-gray-400 group-open:text-primary text-xl">expand_more</span>

</div>

</div>

<div class="flex items-center justify-between w-full pt-1">

<div class="flex items-center gap-2">

<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">150 Items</span>

</div>

<span class="text-base font-bold text-primary dark:text-primary">850,000 FCFA</span>

</div>

</summary>

<!-- Content hidden when collapsed -->

<div class="p-4 border-t border-dashed border-gray-200 dark:border-white/10">

<p class="text-sm text-gray-400">Loading details...</p>

</div>

</details>

<!-- Card 3: Collapsed -->

<details class="group rounded-lg border border-gray-200 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm transition-all duration-300">

<summary class="flex flex-col gap-3 p-4 cursor-pointer select-none bg-surface-light dark:bg-surface-dark transition-colors hover:bg-gray-50 dark:hover:bg-white/5">

<div class="flex items-start justify-between w-full">

<div class="flex flex-col">

<span class="text-base font-bold text-slate-900 dark:text-white">Union Camerounaise (UCB)</span>

<span class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Oct 08, 11:45</span>

</div>

<div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 group-open:bg-primary/20 group-open:rotate-180 transition-all">

<span class="material-symbols-outlined text-gray-500 dark:text-gray-400 group-open:text-primary text-xl">expand_more</span>

</div>

</div>

<div class="flex items-center justify-between w-full pt-1">

<div class="flex items-center gap-2">

<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">80 Items</span>

</div>

<span class="text-base font-bold text-primary dark:text-primary">400,000 FCFA</span>

</div>

</summary>

<div class="p-4 border-t border-dashed border-gray-200 dark:border-white/10">

<p class="text-sm text-gray-400">Loading details...</p>

</div>

</details>

<!-- Card 4: Collapsed -->

<details class="group rounded-lg border border-gray-200 dark:border-white/10 bg-surface-light dark:bg-surface-dark overflow-hidden shadow-sm transition-all duration-300">

<summary class="flex flex-col gap-3 p-4 cursor-pointer select-none bg-surface-light dark:bg-surface-dark transition-colors hover:bg-gray-50 dark:hover:bg-white/5">

<div class="flex items-start justify-between w-full">

<div class="flex flex-col">

<span class="text-base font-bold text-slate-900 dark:text-white">SABC (Special Order)</span>

<span class="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">Oct 05, 16:20</span>

</div>

<div class="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-white/5 group-open:bg-primary/20 group-open:rotate-180 transition-all">

<span class="material-symbols-outlined text-gray-500 dark:text-gray-400 group-open:text-primary text-xl">expand_more</span>

</div>

</div>

<div class="flex items-center justify-between w-full pt-1">

<div class="flex items-center gap-2">

<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300">300 Items</span>

</div>

<span class="text-base font-bold text-primary dark:text-primary">1,500,000 FCFA</span>

</div>

</summary>

<div class="p-4 border-t border-dashed border-gray-200 dark:border-white/10">

<p class="text-sm text-gray-400">Loading details...</p>

</div>

</details>

<div class="flex justify-center py-6">

<p class="text-xs text-gray-500 dark:text-gray-600">End of history for October</p>

</div>

</div>

</main>

<!-- Floating Action Button -->

<div class="absolute bottom-6 right-4 z-50">

<button class="flex items-center gap-2 pl-4 pr-5 h-14 rounded-full bg-primary hover:bg-primary-dark text-white font-bold shadow-lg shadow-primary/30 active:scale-95 transition-all">

<span class="material-symbols-outlined text-2xl">add</span>

<span class="text-base">New Supply</span>

</button>

</div>

<!-- Tab Bar Placeholder (Optional for Context) -->

<nav class="sticky bottom-0 w-full bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-white/5 flex justify-around py-3 z-40 pb-5">

<button class="flex flex-col items-center gap-1 text-gray-400 hover:text-primary transition-colors">

<span class="material-symbols-outlined">dashboard</span>

<span class="text-[10px] font-medium">Dashboard</span>

</button>

<button class="flex flex-col items-center gap-1 text-primary">

<span class="material-symbols-outlined fill-1">inventory_2</span>

<span class="text-[10px] font-medium">Stock</span>

</button>

<button class="flex flex-col items-center gap-1 text-gray-400 hover:text-primary transition-colors">

<span class="material-symbols-outlined">point_of_sale</span>

<span class="text-[10px] font-medium">Sales</span>

</button>

<button class="flex flex-col items-center gap-1 text-gray-400 hover:text-primary transition-colors">

<span class="material-symbols-outlined">manage_accounts</span>

<span class="text-[10px] font-medium">Staff</span>

</button>

</nav>

</div>

</body></html>

<!-- System Activity Audit Log -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>System Activity Audit Log</title>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#1776ba",

                        "background-light": "#f6f7f8",

                        "background-dark": "#111a21",

                        "surface-dark": "#1c262d",

                        "surface-darker": "#162027",

                        "danger": "#e65a5a",

                        "warning": "#d97706",

                        "success": "#10b981",

                    },

                    fontFamily: {

                        "display": ["Manrope", "sans-serif"]

                    },

                    borderRadius: {

                        "DEFAULT": "0.125rem", 

                        "sm": "0.125rem",

                        "lg": "0.25rem", 

                        "xl": "0.5rem", 

                        "full": "0.75rem"

                    },

                },

            },

        }

    </script>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display antialiased min-h-screen flex flex-col overflow-hidden">

<!-- Top App Bar -->

<header class="flex-none bg-background-dark border-b border-white/5 sticky top-0 z-20">

<div class="flex items-center justify-between p-4 pb-3">

<button class="text-white flex size-10 shrink-0 items-center justify-center rounded hover:bg-white/5 transition-colors">

<span class="material-symbols-outlined text-2xl">arrow_back_ios_new</span>

</button>

<div class="flex flex-col items-center">

<h2 class="text-white text-lg font-bold leading-tight tracking-tight">Audit Log</h2>

<span class="text-xs text-gray-400 font-medium">System Activity &amp; Security</span>

</div>

<div class="flex w-10 items-center justify-end">

<button class="text-white flex size-10 shrink-0 items-center justify-center rounded hover:bg-white/5 transition-colors">

<span class="material-symbols-outlined text-2xl">search</span>

</button>

</div>

</div>

<!-- Filter Chips -->

<div class="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar w-full">

<button class="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded bg-primary px-3 transition-transform active:scale-95">

<span class="text-white text-xs font-bold uppercase tracking-wider">All Activity</span>

</button>

<button class="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded bg-surface-dark border border-white/5 px-3 transition-transform active:scale-95 hover:bg-white/5">

<span class="text-danger text-xs font-bold uppercase tracking-wider">High Risk</span>

<span class="flex size-1.5 rounded-full bg-danger animate-pulse"></span>

</button>

<button class="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded bg-surface-dark border border-white/5 px-3 transition-transform active:scale-95 hover:bg-white/5">

<span class="text-gray-300 text-xs font-bold uppercase tracking-wider">Sales</span>

</button>

<button class="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded bg-surface-dark border border-white/5 px-3 transition-transform active:scale-95 hover:bg-white/5">

<span class="text-gray-300 text-xs font-bold uppercase tracking-wider">Stock</span>

</button>

<button class="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded bg-surface-dark border border-white/5 px-3 transition-transform active:scale-95 hover:bg-white/5">

<span class="text-gray-300 text-xs font-bold uppercase tracking-wider">System</span>

</button>

</div>

</header>

<!-- Main Content List -->

<main class="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-6 scroll-smooth">

<!-- Timeline Group: Today -->

<div>

<div class="flex items-center gap-3 mb-3">

<span class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-primary/80">Today, 24 Oct</span>

<div class="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent"></div>

</div>

<div class="flex flex-col gap-2">

<!-- Critical Alert Item -->

<div class="relative group flex items-start gap-3 bg-surface-dark p-3 rounded border-l-2 border-l-danger border-y border-r border-y-white/5 border-r-white/5 shadow-lg shadow-black/20">

<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-danger/10 text-danger">

<span class="material-symbols-outlined text-lg">warning</span>

</div>

<div class="flex flex-1 flex-col justify-center min-w-0">

<div class="flex justify-between items-baseline mb-0.5">

<p class="text-primary text-xs font-bold uppercase tracking-wide truncate">Manager Bob</p>

<p class="text-gray-400 text-[10px] font-mono tabular-nums">23:14</p>

</div>

<p class="text-white text-sm font-semibold leading-snug">Stock Override: <span class="text-gray-300 font-normal">Whiskey Black Label count forced to 5.</span></p>

<p class="text-danger/80 text-xs mt-1.5 font-medium flex items-center gap-1">

<span class="material-symbols-outlined text-[12px]">security</span>

                            Anomaly detected: Value mismatch &gt; 15%

                        </p>

</div>

</div>

<!-- Standard Item -->

<div class="relative group flex items-start gap-3 bg-surface-darker p-3 rounded border border-white/5 hover:border-white/10 transition-colors">

<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">

<span class="material-symbols-outlined text-lg">receipt_long</span>

</div>

<div class="flex flex-1 flex-col justify-center min-w-0">

<div class="flex justify-between items-baseline mb-0.5">

<p class="text-primary text-xs font-bold uppercase tracking-wide truncate">Waitress Alice</p>

<p class="text-gray-500 text-[10px] font-mono tabular-nums">23:10</p>

</div>

<p class="text-gray-200 text-sm font-medium leading-snug">Created Order #1234</p>

<p class="text-gray-500 text-xs mt-0.5">Table 4 • 3x Castel Beer, 1x Grilled Fish</p>

</div>

</div>

<!-- Standard Item -->

<div class="relative group flex items-start gap-3 bg-surface-darker p-3 rounded border border-white/5 hover:border-white/10 transition-colors">

<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-success/10 text-success">

<span class="material-symbols-outlined text-lg">inventory_2</span>

</div>

<div class="flex flex-1 flex-col justify-center min-w-0">

<div class="flex justify-between items-baseline mb-0.5">

<p class="text-primary text-xs font-bold uppercase tracking-wide truncate">Bartender Joe</p>

<p class="text-gray-500 text-[10px] font-mono tabular-nums">22:45</p>

</div>

<p class="text-gray-200 text-sm font-medium leading-snug">Validated Supply Receipt #99</p>

<p class="text-gray-500 text-xs mt-0.5">Restocked: Guinness (Small) x2 Crates</p>

</div>

</div>

<!-- Warning Item -->

<div class="relative group flex items-start gap-3 bg-surface-dark p-3 rounded border-l-2 border-l-warning border-y border-r border-y-white/5 border-r-white/5">

<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-warning/10 text-warning">

<span class="material-symbols-outlined text-lg">backspace</span>

</div>

<div class="flex flex-1 flex-col justify-center min-w-0">

<div class="flex justify-between items-baseline mb-0.5">

<p class="text-primary text-xs font-bold uppercase tracking-wide truncate">Cashier Mike</p>

<p class="text-gray-400 text-[10px] font-mono tabular-nums">22:15</p>

</div>

<p class="text-white text-sm font-semibold leading-snug">Voided Bill #405</p>

<div class="mt-1.5 p-1.5 bg-background-dark rounded border border-white/5">

<p class="text-gray-400 text-[10px]">Reason: "Customer left without paying"</p>

<p class="text-white text-[10px] font-mono mt-0.5">Value: 25,000 XAF</p>

</div>

</div>

</div>

</div>

</div>

<!-- Timeline Group: Yesterday -->

<div>

<div class="flex items-center gap-3 mb-3 pt-2">

<span class="text-[10px] font-extrabold uppercase tracking-[0.15em] text-gray-500">Yesterday, 23 Oct</span>

<div class="h-px flex-1 bg-white/5"></div>

</div>

<div class="flex flex-col gap-2">

<!-- System Item -->

<div class="relative group flex items-start gap-3 bg-surface-darker p-3 rounded border border-white/5 opacity-75 hover:opacity-100 transition-opacity">

<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-gray-700/30 text-gray-400">

<span class="material-symbols-outlined text-lg">dns</span>

</div>

<div class="flex flex-1 flex-col justify-center min-w-0">

<div class="flex justify-between items-baseline mb-0.5">

<p class="text-primary text-xs font-bold uppercase tracking-wide truncate">System</p>

<p class="text-gray-500 text-[10px] font-mono tabular-nums">02:00</p>

</div>

<p class="text-gray-300 text-sm font-medium leading-snug">Automatic Database Backup</p>

<p class="text-gray-500 text-xs mt-0.5">Cloud sync successful</p>

</div>

</div>

<!-- Late Night Sale -->

<div class="relative group flex items-start gap-3 bg-surface-darker p-3 rounded border border-white/5">

<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">

<span class="material-symbols-outlined text-lg">local_bar</span>

</div>

<div class="flex flex-1 flex-col justify-center min-w-0">

<div class="flex justify-between items-baseline mb-0.5">

<p class="text-primary text-xs font-bold uppercase tracking-wide truncate">Head Waiter Jean</p>

<p class="text-gray-500 text-[10px] font-mono tabular-nums">01:45</p>

</div>

<p class="text-gray-200 text-sm font-medium leading-snug">Closed Table #12 (VIP Area)</p>

<p class="text-gray-500 text-xs mt-0.5">Total: 150,000 XAF • Payment: Mobile Money</p>

</div>

</div>

<!-- Security Login -->

<div class="relative group flex items-start gap-3 bg-surface-darker p-3 rounded border border-white/5">

<div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded bg-purple-500/10 text-purple-400">

<span class="material-symbols-outlined text-lg">key</span>

</div>

<div class="flex flex-1 flex-col justify-center min-w-0">

<div class="flex justify-between items-baseline mb-0.5">

<p class="text-primary text-xs font-bold uppercase tracking-wide truncate">Admin</p>

<p class="text-gray-500 text-[10px] font-mono tabular-nums">09:30</p>

</div>

<p class="text-gray-200 text-sm font-medium leading-snug">User Permissions Updated</p>

<p class="text-gray-500 text-xs mt-0.5">Action: Revoked access for 'Cashier_Temp_02'</p>

</div>

</div>

</div>

</div>

<!-- Bottom spacing for scroll -->

<div class="h-12"></div>

</main>

<!-- Floating Action Button for Quick Report -->

<div class="absolute bottom-6 right-6">

<button class="flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-xl shadow-black/50 hover:bg-blue-600 transition-colors">

<span class="material-symbols-outlined text-2xl">download</span>

</button>

</div>

</body></html>

<!-- New Order Entry -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Waitress App - Order Entry</title>

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#141414",

                        "secondary": "#ededed",

                        "background-light": "#f7f7f7",

                        "background-dark": "#191919",

                        "alert-low": "#eab308",

                        "alert-critical": "#ef4444",

                        "success": "#22c55e",

                    },

                    fontFamily: {

                        "display": ["Plus Jakarta Sans", "sans-serif"]

                    },

                    borderRadius: {

                        "DEFAULT": "0.25rem",

                        "lg": "0.5rem",

                        "xl": "0.75rem",

                        "2xl": "1rem",

                        "full": "9999px"

                    },

                    boxShadow: {

                        "soft": "0 4px 20px -2px rgba(0, 0, 0, 0.05)",

                        "float": "0 -4px 20px -2px rgba(0, 0, 0, 0.08)",

                    }

                },

            },

        }

    </script>

<style>.no-scrollbar::-webkit-scrollbar {

            display: none;

        }.no-scrollbar {

            -ms-overflow-style: none;scrollbar-width: none;}

    </style>

<style>

        body {

            min-height: max(884px, 100dvh);

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark text-primary dark:text-white font-display antialiased overflow-hidden h-screen flex flex-col selection:bg-primary selection:text-white">

<header class="flex-none bg-background-light dark:bg-background-dark z-30 pt-safe-top">

<div class="flex items-center p-4 pb-2 justify-between">

<div class="flex flex-col">

<span class="text-neutral-500 text-xs font-semibold uppercase tracking-wider">Service</span>

<h2 class="text-primary dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">Table 12 - New Order</h2>

</div>

<div class="flex w-12 items-center justify-end">

<button class="flex items-center justify-center rounded-full size-10 bg-white dark:bg-neutral-800 shadow-sm border border-neutral-100 dark:border-neutral-700 text-primary dark:text-white hover:bg-neutral-50 transition-colors">

<span class="material-symbols-outlined text-[24px]">search</span>

</button>

</div>

</div>

</header>

<main class="flex-1 overflow-y-auto no-scrollbar relative flex flex-col pb-[180px]">

<div class="sticky top-0 z-20 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm pt-2 pb-4 px-4 border-b border-neutral-200/50 dark:border-neutral-800/50">

<div class="flex gap-3 overflow-x-auto no-scrollbar pb-1">

<button class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-primary dark:bg-white text-white dark:text-primary pl-5 pr-5 shadow-lg shadow-primary/20 transition-transform active:scale-95">

<span class="material-symbols-outlined text-[18px]">sports_bar</span>

<p class="text-sm font-bold leading-normal">Beers</p>

</button>

<button class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 pl-5 pr-5 text-neutral-600 dark:text-neutral-300 transition-transform active:scale-95">

<span class="material-symbols-outlined text-[18px]">local_drink</span>

<p class="text-sm font-medium leading-normal">Sodas</p>

</button>

<button class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 pl-5 pr-5 text-neutral-600 dark:text-neutral-300 transition-transform active:scale-95">

<span class="material-symbols-outlined text-[18px]">liquor</span>

<p class="text-sm font-medium leading-normal">Spirits</p>

</button>

<button class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 pl-5 pr-5 text-neutral-600 dark:text-neutral-300 transition-transform active:scale-95">

<span class="material-symbols-outlined text-[18px]">wine_bar</span>

<p class="text-sm font-medium leading-normal">Wines</p>

</button>

<button class="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 pl-5 pr-5 text-neutral-600 dark:text-neutral-300 transition-transform active:scale-95">

<span class="material-symbols-outlined text-[18px]">restaurant</span>

<p class="text-sm font-medium leading-normal">Food</p>

</button>

</div>

</div>

<div class="flex flex-col gap-3 px-4 py-4">

<div class="group flex flex-col bg-white dark:bg-neutral-800 rounded-xl p-3 shadow-soft border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 transition-all">

<div class="flex gap-4">

<div class="relative shrink-0">

<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[80px]" data-alt="Dark stout beer bottle with condensation" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBvBORZBnQrJ1V2Hu2glysXzdXpVPK9BbM8YUQGhg6tzLQCTBinL6JSXHXRZyfmR_JN4FffePOougTyURrxPm7ubxfuk0d9viAruC6uldLARdScCCcDPCrKJ5ATQppARJK8Bhnggyr0Fv83BIF01K7aPZMkFVURgk-NNxy15BEAYFlRIaPgmNbJOcL_DMJPzQJrr9Tdg7phtBSPSH1bQYK13cRAGxTkGJtleeJmkoBLF9Ek7LDO4jPL43F5l4nHfjbQ3PT-zILiCAzR");'></div>

<div class="absolute -top-2 -left-2 bg-neutral-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">Large</div>

</div>

<div class="flex flex-1 flex-col justify-between py-1">

<div>

<div class="flex justify-between items-start">

<p class="text-primary dark:text-white text-base font-bold leading-tight">Guinness Large</p>

<p class="text-primary dark:text-white text-base font-bold">1,500 <span class="text-xs font-normal text-neutral-500">FCFA</span></p>

</div>

<div class="mt-1 flex items-center gap-1.5">

<div class="size-2 rounded-full bg-emerald-500"></div>

<p class="text-neutral-500 text-sm font-medium">Stock: 14</p>

</div>

</div>

<div class="flex justify-end mt-2">

<div class="flex items-center bg-secondary dark:bg-neutral-700 rounded-lg h-8">

<button class="w-8 h-full flex items-center justify-center text-primary dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-l-lg transition-colors">

<span class="material-symbols-outlined text-sm">remove</span>

</button>

<span class="w-6 text-center text-sm font-bold">2</span>

<button class="w-8 h-full flex items-center justify-center text-primary dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-r-lg transition-colors">

<span class="material-symbols-outlined text-sm">add</span>

</button>

</div>

</div>

</div>

</div>

</div>

<div class="group flex flex-col bg-white dark:bg-neutral-800 rounded-xl p-3 shadow-soft border border-transparent transition-all">

<div class="flex gap-4">

<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[80px]" data-alt="Green beer bottle cold" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDQbceMVI-QGJFaPAdv3KL9U2mn_7NdRXIolZuHf52ytHth8Lr0MxlL8UMJ2r9zWsyxLyuF7AzInbrSgbr5q90ggXQUbAyeQFoNNKUXzeEDknXKs0OJ6E4BPEGxIn_2HJqAYmOnH3FQ7IJvCHzph1LbNPpaOepEKupDxhF3GsJFAoU1QtkP8qKQ6cvrpmga-YAsIFMgls7vbT3-EvWeI15kc9ULj8ryG6ehJumVZvK1ldCigRpYK4O1bZI60DSp6bJN6V7DvUsVkOSI");'></div>

<div class="flex flex-1 flex-col justify-between py-1">

<div>

<div class="flex justify-between items-start">

<p class="text-primary dark:text-white text-base font-bold leading-tight">Heineken</p>

<p class="text-primary dark:text-white text-base font-bold">1,200 <span class="text-xs font-normal text-neutral-500">FCFA</span></p>

</div>

<div class="mt-1 flex items-center gap-1.5">

<div class="size-2 rounded-full bg-alert-low animate-pulse"></div>

<p class="text-alert-low text-sm font-bold">Low Stock: 4</p>

</div>

</div>

<div class="flex justify-end mt-2">

<button class="flex items-center justify-center rounded-lg h-8 px-4 bg-secondary dark:bg-neutral-700 text-primary dark:text-white text-sm font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors active:scale-95">

                                Add

                            </button>

</div>

</div>

</div>

</div>

<div class="group flex flex-col bg-white dark:bg-neutral-800 rounded-xl p-3 shadow-soft border border-transparent transition-all">

<div class="flex gap-4">

<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[80px]" data-alt="Glass of cold cola with ice" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuA68oHqXIxCb1yM92r3n0Ug-YLciMnVSobit5ppJrGwTceSTZv_y2SgDa464hwl6pQ9hYIB2mbUe6D8skqb9wt5lAp8Vy-YKQlSrYKtpvR5rzzajgj9yDkXuaezCldasVgjJuxdNvzUqU7UvslXkv8EU8ekv1iMbIy2ZbHZInzhb0vpMRbzkC_ee4XWcLm7kGs_cgMzPRlw6N5ivviup2HxF3h7fqjRUfYQJib17s6UZ9LVbPTjNp4b2ua6TJwYN18meB2YeoLXldLc");'></div>

<div class="flex flex-1 flex-col justify-between py-1">

<div>

<div class="flex justify-between items-start">

<p class="text-primary dark:text-white text-base font-bold leading-tight">Coca Cola</p>

<p class="text-primary dark:text-white text-base font-bold">800 <span class="text-xs font-normal text-neutral-500">FCFA</span></p>

</div>

<div class="mt-1 flex items-center gap-1.5">

<div class="size-2 rounded-full bg-emerald-500"></div>

<p class="text-neutral-500 text-sm font-medium">Stock: 42</p>

</div>

</div>

<div class="flex justify-end mt-2">

<div class="flex items-center bg-secondary dark:bg-neutral-700 rounded-lg h-8">

<button class="w-8 h-full flex items-center justify-center text-primary dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-l-lg transition-colors">

<span class="material-symbols-outlined text-sm">remove</span>

</button>

<span class="w-6 text-center text-sm font-bold">1</span>

<button class="w-8 h-full flex items-center justify-center text-primary dark:text-white hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-r-lg transition-colors">

<span class="material-symbols-outlined text-sm">add</span>

</button>

</div>

</div>

</div>

</div>

</div>

<div class="group flex flex-col bg-white dark:bg-neutral-800 rounded-xl p-3 shadow-soft border border-transparent transition-all">

<div class="flex gap-4">

<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[80px] grayscale opacity-80" data-alt="bottle of whisky on table" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuAu0zJONlgonSn6ni93UleIkBwzKZ2XnEubgiyHGEOcydSJuqUjx02DrEwJgNLupG36nsfU7QVxJm5oW7gyiW8r5vAjhiPlP3qXWNHutfl5HNEsZU8cGaWye4AzyJCESNCuq_EsXt1IZUil_IL5xBXySVergQY1WQPDqZoEd2jTTsf-6n1xYRk6T0PxzWsTq5wEh81Y0kP4TJPJ8NO7WK4OYqh8OLm8hiRLpeSuukM_8Yhw46_DBbfodQ7UXqDEtvAwcFphCT95SnpG");'></div>

<div class="flex flex-1 flex-col justify-between py-1">

<div>

<div class="flex justify-between items-start">

<p class="text-primary dark:text-white text-base font-bold leading-tight">Black Label</p>

<p class="text-primary dark:text-white text-base font-bold">25,000 <span class="text-xs font-normal text-neutral-500">FCFA</span></p>

</div>

<div class="mt-1 flex items-center gap-1.5">

<div class="size-2 rounded-full bg-alert-critical animate-pulse"></div>

<p class="text-alert-critical text-sm font-bold">Critical: 1 Left</p>

</div>

</div>

<div class="flex justify-end mt-2">

<button class="flex items-center justify-center rounded-lg h-8 px-4 bg-secondary dark:bg-neutral-700 text-primary dark:text-white text-sm font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors active:scale-95">

                                Add

                            </button>

</div>

</div>

</div>

</div>

<div class="group flex flex-col bg-neutral-100 dark:bg-neutral-900 rounded-xl p-3 border border-dashed border-neutral-300 dark:border-neutral-700 opacity-60">

<div class="flex gap-4">

<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[80px]" data-alt="bottle of castle beer" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBUUbwu05rLcb-AgPF27-ijClulsAWRxeSPS0sNy-4RD-J_gKw52ngQj3nuOWE_LqgcWCJKn39siPl2WHfuJDkKvAJ59On9DfX-RP2fSgScGRreJHXk6rWEKGjD3q8678t6xzbgFaU_nfjinTsHqCjIRIueT2UN0BTXIeh92mbEQE7hxT0KykBIK3suM9ogz4b58vWP-rDdinQV-usVUJjNjEptpWzDSUY41pL2795q7VZhjjDVH--uoAVgsNnBJmNNuo-780SH3-Dw");'></div>

<div class="flex flex-1 flex-col justify-between py-1">

<div>

<div class="flex justify-between items-start">

<p class="text-neutral-600 dark:text-neutral-400 text-base font-bold leading-tight">Castle Milk Stout</p>

<p class="text-neutral-500 text-base font-medium">1,200 FCFA</p>

</div>

<div class="mt-1 flex items-center gap-1.5">

<span class="material-symbols-outlined text-[14px] text-neutral-500">block</span>

<p class="text-neutral-500 text-sm font-medium">Out of stock</p>

</div>

</div>

<div class="flex justify-end mt-2">

<button class="flex items-center justify-center rounded-lg h-8 px-4 bg-transparent border border-neutral-300 dark:border-neutral-700 text-neutral-400 text-sm font-medium cursor-not-allowed" disabled="">

                                Unavailable

                            </button>

</div>

</div>

</div>

</div>

<div class="group flex flex-col bg-white dark:bg-neutral-800 rounded-xl p-3 shadow-soft border border-transparent transition-all">

<div class="flex gap-4">

<div class="bg-center bg-no-repeat aspect-square bg-cover rounded-lg size-[80px]" data-alt="Glass of cold orange soda" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuC863CvECSuKjVg5WUcvCi7nJh15xRFF00vI-SOyXQBbqo1pTijTSYAHtDFXNoYzRq3fFG82MI0dbTkDdZ3N4Z3DTWdLzSCgsvXUxfzBHqugWYACVnMdu9Hkwa40IgWZUe1U69zQeML1dM6E56Cmvv6u14cV5CxaVgAZ5syY1mGT4KjsqsXNFgKLfISQIH_v89OkZdGaGJDMcvZ_ZFcKZXN6RNs0Lg5pNGZBxeC20FL083k0wu7UEjCnX-j9u3AYfED5Gc5eXag5co3");'></div>

<div class="flex flex-1 flex-col justify-between py-1">

<div>

<div class="flex justify-between items-start">

<p class="text-primary dark:text-white text-base font-bold leading-tight">Fanta Orange</p>

<p class="text-primary dark:text-white text-base font-bold">800 <span class="text-xs font-normal text-neutral-500">FCFA</span></p>

</div>

<div class="mt-1 flex items-center gap-1.5">

<div class="size-2 rounded-full bg-emerald-500"></div>

<p class="text-neutral-500 text-sm font-medium">Stock: 24</p>

</div>

</div>

<div class="flex justify-end mt-2">

<button class="flex items-center justify-center rounded-lg h-8 px-4 bg-secondary dark:bg-neutral-700 text-primary dark:text-white text-sm font-bold hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors active:scale-95">

                                Add

                            </button>

</div>

</div>

</div>

</div>

</div>

</main>

<footer class="fixed bottom-0 left-0 w-full z-40">

<div class="bg-white dark:bg-neutral-800 rounded-t-2xl shadow-float border-t border-neutral-100 dark:border-neutral-700 p-5 pb-8 relative">

<div class="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 bg-neutral-200 dark:bg-neutral-600 rounded-full"></div>

<div class="flex flex-col gap-4">

<div class="flex justify-between items-end mb-1">

<div class="flex flex-col">

<span class="text-sm font-medium text-neutral-500">Order Total (3 items)</span>

<div class="flex items-baseline gap-1">

<span class="text-2xl font-extrabold text-primary dark:text-white">3,800</span>

<span class="text-sm font-bold text-neutral-500">FCFA</span>

</div>

</div>

<div class="flex -space-x-3 mb-1">

<div class="size-8 rounded-full border-2 border-white dark:border-neutral-800 bg-neutral-200 bg-cover bg-center" data-alt="beer" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCNN9-DRT_iQLyKh3mqys8zTUQtrnD6KatzO1-ncqy7Ji8ipBY1zKlMYEhm9vWCwf8VO1DbUIdiwmucQSvRDLl5C_EJmTYwjXXWRN5p26CHvQoNPb90SFhtmXi9lpkALmqbR8cLJ879NSKCY39SgKgbpgP6wIfg4FaSz3FJ_f7bRtgJQr63WKyPUtymFP3YXRl9cOwZ8JenypbJnvOJQCUKiM45Hlf3I5AGG9lZRcTYxQdsYFJhxb4czFzGOeXkjnBaW2IS16MPWJDX");'></div>

<div class="size-8 rounded-full border-2 border-white dark:border-neutral-800 bg-neutral-200 bg-cover bg-center" data-alt="beer" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuDWbBsmTc8StJlUU53LZCtTih-P9f1xQGS4XP6CTFww3YCyuEVRfjn_b9sxBgSaotmp0j67qBeQREQd4t7fUSbDSCh5QKL5vAagGt4WEBHBYMcNdi7uzsS_gAU6fXvZta4vt-RuuexvqZet4K8sar9eDTkA0ig1bfl4I1XI9SZIblrjF5yHoCKnP2tdm2HuHfr1q6BPPye8Ex4gCUDEJkNmf23mSOjUfWUgIhAsOD-H-Mxi6cNiWPCNJnZqOs01DNK_UdehOTMLq7rm");'></div>

<div class="size-8 rounded-full border-2 border-white dark:border-neutral-800 bg-neutral-200 bg-cover bg-center" data-alt="soda" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCiTUg5TAKVlWv9QycM-esT2nZKNB5ZavFoUCCHnqVT5OOKl5v2qAEVqZKFe4ANxxM2y11IqUhpkz8AfD-pmBA-DNnbERGexHAdS1s2ipsJNbppwiDIyWE0AWi-mX5IXwjRq4g42cwhMxXpKhvvqVd4IZyO1q38oMobihAWmnqfVO2PRFgtZoUvZDeHHwjmEsZGuGW0rjhytoP0KdgCVUxqoVPOUhG8lifv0UgutYVfMkyKo_0SizAPDqdRxrb22vJL-PDpenFJdR11");'></div>

</div>

</div>

<div class="flex gap-3">

<button class="flex-1 bg-primary dark:bg-white hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-primary rounded-xl h-14 flex items-center justify-between px-6 shadow-lg shadow-neutral-900/10 active:scale-[0.98] transition-all">

<span class="font-bold text-base">Confirm Order</span>

<span class="material-symbols-outlined">arrow_forward</span>

</button>

<button class="bg-secondary dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 text-primary dark:text-white rounded-xl h-14 w-14 flex items-center justify-center transition-colors">

<span class="material-symbols-outlined">expand_less</span>

</button>

</div>

</div>

</div>

</footer>

</body></html>

<!-- Record New Supply Arrival -->

<!DOCTYPE html>

<html class="light"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Profit &amp; Loss Reports</title>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

      tailwind.config = {

        darkMode: "class",

        theme: {

          extend: {

            colors: {

              "primary": "#1776ba",

              "primary-dark": "#105a8f",

              "background-light": "#f0f2f4",

              "background-dark": "#1a1d23",

              "card-light": "#ffffff",

              "card-dark": "#252a33",

              "border-light": "#e2e8f0",

              "border-dark": "#343b45",

              "success": "#10b981",

              "danger": "#ef4444",

            },

            fontFamily: {

              "display": ["Manrope", "sans-serif"]

            },

            borderRadius: {"DEFAULT": "0.125rem", "lg": "0.25rem", "xl": "0.5rem", "full": "0.75rem"},

          },

        },

      }

    </script>

<style>::-webkit-scrollbar { width: 6px; }

        ::-webkit-scrollbar-track { background: transparent; }

        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        .dark ::-webkit-scrollbar-thumb { background: #475569; }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden min-h-screen flex flex-col">

<header class="sticky top-0 z-40 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md border-b border-border-light dark:border-border-dark transition-colors duration-300">

<div class="flex items-center justify-between px-4 h-[60px]">

<button aria-label="Go back" class="flex items-center justify-center w-10 h-10 -ml-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors group">

<span class="material-symbols-outlined group-hover:-translate-x-0.5 transition-transform">arrow_back</span>

</button>

<h1 class="text-lg font-bold tracking-tight text-slate-900 dark:text-white truncate">Profit &amp; Loss Reports</h1>

<div class="w-8"></div>

</div>

</header>

<main class="flex-1 px-4 py-6 space-y-6 pb-32">

<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-4">

<label class="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Reporting Period</label>

<div class="flex items-center gap-3">

<div class="relative flex-1">

<input class="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" type="date" value="2023-10-01"/>

<label class="absolute -top-2 left-2 px-1 bg-card-light dark:bg-card-dark text-[10px] text-primary font-bold">FROM</label>

</div>

<span class="text-slate-400 font-bold">-</span>

<div class="relative flex-1">

<input class="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/50 border border-border-light dark:border-border-dark rounded-lg text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" type="date" value="2023-10-31"/>

<label class="absolute -top-2 left-2 px-1 bg-card-light dark:bg-card-dark text-[10px] text-primary font-bold">TO</label>

</div>

</div>

</div>

<div class="grid grid-cols-2 gap-3">

<div class="bg-gradient-to-br from-primary to-primary-dark rounded-xl p-4 text-white shadow-lg relative overflow-hidden">

<div class="absolute right-0 top-0 w-16 h-16 bg-white/10 rounded-full -mr-4 -mt-4 blur-xl"></div>

<p class="text-primary-100 text-xs font-medium uppercase tracking-wider mb-1">Net Profit</p>

<p class="text-2xl font-extrabold tracking-tight">854k</p>

<p class="text-xs text-primary-200 mt-1">FCFA</p>

</div>

<div class="bg-card-light dark:bg-card-dark rounded-xl p-4 border border-border-light dark:border-border-dark shadow-sm flex flex-col justify-center">

<div class="flex justify-between items-end mb-2">

<span class="text-slate-500 text-xs uppercase font-bold">Revenue</span>

<span class="text-slate-900 dark:text-white font-bold">2.4M</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mb-3 overflow-hidden">

<div class="bg-emerald-500 h-full rounded-full" style="width: 100%"></div>

</div>

<div class="flex justify-between items-end mb-1">

<span class="text-slate-500 text-xs uppercase font-bold">Costs</span>

<span class="text-slate-900 dark:text-white font-bold">1.5M</span>

</div>

<div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">

<div class="bg-rose-500 h-full rounded-full" style="width: 62%"></div>

</div>

</div>

</div>

<div class="space-y-4">

<div class="flex items-center justify-between ml-1">

<h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ranked by Profitability</h2>

<button class="text-primary text-xs font-bold hover:underline">View All</button>

</div>

<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-border-light dark:border-border-dark p-0 overflow-hidden">

<div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">

<div class="flex items-center gap-3">

<div class="w-6 h-6 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center text-xs font-bold border border-yellow-200">1</div>

<div>

<h3 class="text-sm font-bold text-slate-900 dark:text-white">Castel Beer 65cl</h3>

</div>

</div>

<span class="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">35% Margin</span>

</div>

<div class="p-4 grid grid-cols-3 gap-4 divide-x divide-slate-100 dark:divide-slate-700">

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Sales</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">850,000</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Cost</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">552,500</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-emerald-600/70 mb-1">Net Profit</p>

<p class="text-base font-extrabold text-emerald-600">+297,500</p>

</div>

</div>

</div>

<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-border-light dark:border-border-dark p-0 overflow-hidden">

<div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">

<div class="flex items-center gap-3">

<div class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-200">2</div>

<div>

<h3 class="text-sm font-bold text-slate-900 dark:text-white">Guinness Smooth</h3>

</div>

</div>

<span class="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">28% Margin</span>

</div>

<div class="p-4 grid grid-cols-3 gap-4 divide-x divide-slate-100 dark:divide-slate-700">

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Sales</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">620,000</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Cost</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">446,400</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-emerald-600/70 mb-1">Net Profit</p>

<p class="text-base font-extrabold text-emerald-600">+173,600</p>

</div>

</div>

</div>

<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-border-light dark:border-border-dark p-0 overflow-hidden">

<div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">

<div class="flex items-center gap-3">

<div class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-200">3</div>

<div>

<h3 class="text-sm font-bold text-slate-900 dark:text-white">Beaufort Light</h3>

</div>

</div>

<span class="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">22% Margin</span>

</div>

<div class="p-4 grid grid-cols-3 gap-4 divide-x divide-slate-100 dark:divide-slate-700">

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Sales</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">450,000</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Cost</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">351,000</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-emerald-600/70 mb-1">Net Profit</p>

<p class="text-base font-extrabold text-emerald-600">+99,000</p>

</div>

</div>

</div>

<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-border-light dark:border-border-dark p-0 overflow-hidden opacity-90">

<div class="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">

<div class="flex items-center gap-3">

<div class="w-6 h-6 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold border border-slate-200">42</div>

<div>

<h3 class="text-sm font-bold text-slate-900 dark:text-white">Expiring Sodas</h3>

</div>

</div>

<span class="text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">-5% Margin</span>

</div>

<div class="p-4 grid grid-cols-3 gap-4 divide-x divide-slate-100 dark:divide-slate-700">

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Sales</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">40,000</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-slate-400 mb-1">Total Cost</p>

<p class="text-sm font-bold text-slate-900 dark:text-white">42,000</p>

</div>

<div class="text-center">

<p class="text-[10px] font-bold uppercase text-red-600/70 mb-1">Net Profit</p>

<p class="text-base font-extrabold text-red-600">-2,000</p>

</div>

</div>

</div>

</div>

</main>

<div class="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-card-dark/95 backdrop-blur-md border-t border-border-light dark:border-border-dark z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">

<button class="w-full bg-slate-900 dark:bg-primary hover:bg-slate-800 dark:hover:bg-primary-dark text-white font-bold h-14 rounded-xl shadow-lg shadow-slate-900/20 dark:shadow-primary/30 flex items-center justify-center gap-3 transition-transform active:scale-[0.98]">

<span class="material-symbols-outlined">download</span>

<span>Export PDF/CSV</span>

</button>

</div>

</body></html>

<!-- Outstanding Debts Tracking -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Outstanding Debts Tracking</title>

<!-- Google Fonts: Manrope -->

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet"/>

<!-- Material Symbols -->

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<!-- Tailwind CSS -->

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#1d8ea5",

                        "primary-dark": "#156a7b",

                        "background-light": "#f7f7f8",

                        "background-dark": "#16181d",

                        "surface-dark": "#292d34",

                        "surface-border": "#3a404a",

                        "text-primary": "#e3e6eb",

                        "text-secondary": "#959aa3",

                        "alert": "#e1a14d",

                    },

                    fontFamily: {

                        "display": ["Manrope", "sans-serif"],

                        "mono": ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", "monospace"],

                    },

                    borderRadius: {"DEFAULT": "0.125rem", "sm": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"},

                },

            },

        }

    </script>

<style>

        body {

            font-family: 'Manrope', sans-serif;

        }

        .material-symbols-outlined {

            font-variation-settings:

            'FILL' 0,

            'wght' 400,

            'GRAD' 0,

            'opsz' 24

        }

        .icon-fill {

            font-variation-settings: 'FILL' 1;

        }

        /* Hide scrollbar for clean horizontal scrolling */

        .no-scrollbar::-webkit-scrollbar {

            display: none;

        }

        .no-scrollbar {

            -ms-overflow-style: none;

            scrollbar-width: none;

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-dark text-text-primary h-full min-h-screen selection:bg-primary selection:text-white">

<div class="relative flex h-full min-h-screen w-full flex-col max-w-md mx-auto border-x border-surface-border/30 shadow-2xl">

<!-- Header Section -->

<header class="sticky top-0 z-50 bg-[#16181d]/95 backdrop-blur-md border-b border-surface-border">

<div class="flex items-center p-4 pb-2 justify-between">

<button class="text-white flex size-10 shrink-0 items-center justify-center rounded hover:bg-white/5 transition-colors">

<span class="material-symbols-outlined text-text-primary">arrow_back</span>

</button>

<div class="flex gap-4 items-center">

<button class="text-white flex size-10 shrink-0 items-center justify-center rounded hover:bg-white/5 transition-colors">

<span class="material-symbols-outlined text-text-primary">filter_list</span>

</button>

<button class="text-white flex size-10 shrink-0 items-center justify-center rounded hover:bg-white/5 transition-colors">

<span class="material-symbols-outlined text-text-primary">more_vert</span>

</button>

</div>

</div>

<!-- ProfileStats / Summary Dashboard -->

<div class="px-6 py-6 flex flex-col items-center justify-center relative overflow-hidden">

<!-- Abstract background decoration -->

<div class="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-primary/10 blur-[60px] rounded-full pointer-events-none"></div>

<p class="text-text-secondary text-sm font-medium uppercase tracking-widest mb-1 z-10">Total Outstanding</p>

<h1 class="text-5xl font-extrabold tracking-tight text-white z-10">

<span class="text-2xl font-bold text-primary align-top mt-2 inline-block mr-1">FCFA</span>450,000

                </h1>

<div class="flex gap-6 mt-6 w-full justify-center">

<div class="flex items-center gap-2">

<div class="w-2 h-2 rounded-full bg-alert"></div>

<span class="text-xs text-text-secondary font-medium">3 Overdue (&gt;24h)</span>

</div>

<div class="flex items-center gap-2">

<div class="w-2 h-2 rounded-full bg-primary"></div>

<span class="text-xs text-text-secondary font-medium">5 Pending</span>

</div>

</div>

</div>

<!-- Chips / Filters -->

<div class="flex gap-3 px-4 py-3 overflow-x-auto no-scrollbar border-t border-surface-border/50 bg-[#16181d]">

<button class="group flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-surface-dark border border-primary text-white pl-3 pr-4 transition-all active:scale-95">

<span class="w-2 h-2 rounded-full bg-primary group-hover:animate-pulse"></span>

<p class="text-sm font-bold leading-normal">All Invoices</p>

</button>

<button class="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-surface-dark border border-transparent hover:border-surface-border text-text-secondary pl-3 pr-4 transition-all active:scale-95">

<span class="material-symbols-outlined text-alert !text-[18px]">warning</span>

<p class="text-sm font-medium leading-normal text-text-primary">Overdue</p>

</button>

<button class="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-surface-dark border border-transparent hover:border-surface-border text-text-secondary pl-3 pr-4 transition-all active:scale-95">

<span class="material-symbols-outlined !text-[18px]">schedule</span>

<p class="text-sm font-medium leading-normal text-text-primary">Pending</p>

</button>

<button class="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-surface-dark border border-transparent hover:border-surface-border text-text-secondary pl-3 pr-4 transition-all active:scale-95">

<span class="material-symbols-outlined !text-[18px]">history</span>

<p class="text-sm font-medium leading-normal text-text-primary">Partially Paid</p>

</button>

</div>

</header>

<!-- Main Content: Invoice List -->

<main class="flex-1 p-4 flex flex-col gap-3 pb-8">

<!-- Date Divider -->

<div class="flex items-center gap-4 py-2 opacity-60">

<div class="h-px bg-surface-border flex-1"></div>

<span class="text-xs font-mono uppercase text-text-secondary">Today</span>

<div class="h-px bg-surface-border flex-1"></div>

</div>

<!-- Card: Urgent / Overdue -->

<div class="group relative flex flex-col gap-3 rounded-sm bg-surface-dark p-4 border-l-2 border-alert shadow-lg hover:bg-[#2e333b] transition-colors cursor-pointer">

<!-- Top Row: ID & Amount -->

<div class="flex items-start justify-between">

<div class="flex flex-col">

<div class="flex items-center gap-2">

<span class="font-mono text-xs text-text-secondary tracking-wide">#INV-0998</span>

<span class="flex items-center gap-1 rounded bg-alert/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-alert border border-alert/20">

<span class="material-symbols-outlined !text-[12px] icon-fill">warning</span>

                                Overdue

                            </span>

</div>

<h3 class="text-xl font-bold text-white mt-1 tracking-tight">FCFA 42,500</h3>

</div>

<div class="size-8 rounded-full bg-surface-border/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">

<span class="material-symbols-outlined !text-[20px]">chevron_right</span>

</div>

</div>

<!-- Divider -->

<div class="h-px w-full bg-white/5"></div>

<!-- Details Grid -->

<div class="grid grid-cols-2 gap-y-2 text-sm">

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Waitress</span>

<span class="text-text-primary font-medium">Estelle M.</span>

</div>

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Table</span>

<span class="text-text-primary font-medium">VIP 2 <span class="text-xs text-text-secondary font-normal">(Lounge)</span></span>

</div>

<div class="flex flex-col gap-0.5 col-span-2 mt-1">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Age</span>

<div class="flex items-center gap-2 text-alert font-mono text-xs">

<span class="material-symbols-outlined !text-[14px]">hourglass_bottom</span>

                             26h 15m since generation

                        </div>

</div>

</div>

</div>

<!-- Card: Standard / Recent -->

<div class="group relative flex flex-col gap-3 rounded-sm bg-surface-dark p-4 border border-transparent hover:border-surface-border shadow-sm transition-colors cursor-pointer">

<div class="flex items-start justify-between">

<div class="flex flex-col">

<div class="flex items-center gap-2">

<span class="font-mono text-xs text-text-secondary tracking-wide">#INV-1024</span>

<span class="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary border border-primary/20">

                                Pending

                            </span>

</div>

<h3 class="text-xl font-bold text-white mt-1 tracking-tight">FCFA 15,000</h3>

</div>

<div class="size-8 rounded-full bg-surface-border/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">

<span class="material-symbols-outlined !text-[20px]">chevron_right</span>

</div>

</div>

<div class="h-px w-full bg-white/5"></div>

<div class="grid grid-cols-2 gap-y-2 text-sm">

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Waitress</span>

<span class="text-text-primary font-medium">Amara K.</span>

</div>

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Table</span>

<span class="text-text-primary font-medium">Table 4</span>

</div>

<div class="flex flex-col gap-0.5 col-span-2 mt-1">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Age</span>

<div class="flex items-center gap-2 text-text-secondary font-mono text-xs">

<span class="material-symbols-outlined !text-[14px]">schedule</span>

                             4h 30m

                        </div>

</div>

</div>

</div>

<!-- Card: Standard / Recent -->

<div class="group relative flex flex-col gap-3 rounded-sm bg-surface-dark p-4 border border-transparent hover:border-surface-border shadow-sm transition-colors cursor-pointer">

<div class="flex items-start justify-between">

<div class="flex flex-col">

<div class="flex items-center gap-2">

<span class="font-mono text-xs text-text-secondary tracking-wide">#INV-1022</span>

<span class="flex items-center gap-1 rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-400 border border-orange-500/20">

                                Partial

                            </span>

</div>

<h3 class="text-xl font-bold text-white mt-1 tracking-tight">FCFA 8,500 <span class="text-sm font-normal text-text-secondary ml-1">/ 22,000</span></h3>

</div>

<div class="size-8 rounded-full bg-surface-border/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">

<span class="material-symbols-outlined !text-[20px]">chevron_right</span>

</div>

</div>

<div class="h-px w-full bg-white/5"></div>

<div class="grid grid-cols-2 gap-y-2 text-sm">

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Waitress</span>

<span class="text-text-primary font-medium">Sarah J.</span>

</div>

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Table</span>

<span class="text-text-primary font-medium">Bar Seat 08</span>

</div>

<div class="flex flex-col gap-0.5 col-span-2 mt-1">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Age</span>

<div class="flex items-center gap-2 text-text-secondary font-mono text-xs">

<span class="material-symbols-outlined !text-[14px]">schedule</span>

                             5h 12m

                        </div>

</div>

</div>

</div>

<!-- Date Divider -->

<div class="flex items-center gap-4 py-2 opacity-60 mt-2">

<div class="h-px bg-surface-border flex-1"></div>

<span class="text-xs font-mono uppercase text-text-secondary">Yesterday</span>

<div class="h-px bg-surface-border flex-1"></div>

</div>

<!-- Card: Urgent / Overdue -->

<div class="group relative flex flex-col gap-3 rounded-sm bg-surface-dark p-4 border-l-2 border-alert shadow-lg hover:bg-[#2e333b] transition-colors cursor-pointer opacity-90">

<div class="flex items-start justify-between">

<div class="flex flex-col">

<div class="flex items-center gap-2">

<span class="font-mono text-xs text-text-secondary tracking-wide">#INV-0985</span>

<span class="flex items-center gap-1 rounded bg-alert/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-alert border border-alert/20">

<span class="material-symbols-outlined !text-[12px] icon-fill">warning</span>

                                Overdue

                            </span>

</div>

<h3 class="text-xl font-bold text-white mt-1 tracking-tight">FCFA 120,000</h3>

</div>

<div class="size-8 rounded-full bg-surface-border/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">

<span class="material-symbols-outlined !text-[20px]">chevron_right</span>

</div>

</div>

<div class="h-px w-full bg-white/5"></div>

<div class="grid grid-cols-2 gap-y-2 text-sm">

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Waitress</span>

<span class="text-text-primary font-medium">Manager</span>

</div>

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Table</span>

<span class="text-text-primary font-medium">Event Hall</span>

</div>

<div class="flex flex-col gap-0.5 col-span-2 mt-1">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Age</span>

<div class="flex items-center gap-2 text-alert font-mono text-xs">

<span class="material-symbols-outlined !text-[14px]">hourglass_bottom</span>

                             38h 05m since generation

                        </div>

</div>

</div>

</div>

<!-- Card: Urgent / Overdue -->

<div class="group relative flex flex-col gap-3 rounded-sm bg-surface-dark p-4 border-l-2 border-alert shadow-lg hover:bg-[#2e333b] transition-colors cursor-pointer opacity-90">

<div class="flex items-start justify-between">

<div class="flex flex-col">

<div class="flex items-center gap-2">

<span class="font-mono text-xs text-text-secondary tracking-wide">#INV-0982</span>

<span class="flex items-center gap-1 rounded bg-alert/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-alert border border-alert/20">

<span class="material-symbols-outlined !text-[12px] icon-fill">warning</span>

                                Overdue

                            </span>

</div>

<h3 class="text-xl font-bold text-white mt-1 tracking-tight">FCFA 5,000</h3>

</div>

<div class="size-8 rounded-full bg-surface-border/30 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">

<span class="material-symbols-outlined !text-[20px]">chevron_right</span>

</div>

</div>

<div class="h-px w-full bg-white/5"></div>

<div class="grid grid-cols-2 gap-y-2 text-sm">

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Waitress</span>

<span class="text-text-primary font-medium">Amara K.</span>

</div>

<div class="flex flex-col gap-0.5">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Table</span>

<span class="text-text-primary font-medium">Table 2</span>

</div>

<div class="flex flex-col gap-0.5 col-span-2 mt-1">

<span class="text-[11px] uppercase text-text-secondary font-semibold">Age</span>

<div class="flex items-center gap-2 text-alert font-mono text-xs">

<span class="material-symbols-outlined !text-[14px]">hourglass_bottom</span>

                             42h 10m since generation

                        </div>

</div>

</div>

</div>

</main>

<!-- Bottom Floating Action Button (Optional Context Specific) -->

<div class="fixed bottom-6 right-6 z-50">

<button class="flex items-center justify-center size-14 rounded-full bg-primary shadow-lg shadow-primary/30 text-white hover:scale-105 transition-transform">

<span class="material-symbols-outlined">add</span>

</button>

</div>

</div>

</body></html>

<!-- User Profile & Settings -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>User Profile &amp; Settings</title>

<!-- Google Fonts -->

<link href="https://fonts.googleapis.com" rel="preconnect"/>

<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect"/>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&amp;display=swap" rel="stylesheet"/>

<!-- Material Symbols -->

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<!-- Tailwind CSS -->

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<!-- Tailwind Config -->

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#1d8ea5",

                        "primary-dark": "#156a7c",

                        "background-light": "#f4f5f6",

                        "background-dark": "#1c1f22", // Deep Charcoal

                        "surface-dark": "#25292e", // Slightly lighter for cards

                        "surface-highlight": "#2C3035", // Even lighter for interactions

                        "danger": "#CC2647",

                    },

                    fontFamily: {

                        "display": ["Manrope", "sans-serif"]

                    },

                    borderRadius: {

                        "DEFAULT": "0.25rem",

                        "sm": "0.25rem", // 4px per design plan

                        "md": "0.375rem",

                        "lg": "0.5rem",

                        "xl": "0.75rem",

                        "2xl": "1rem",

                        "full": "9999px"

                    },

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar for webkit */

        ::-webkit-scrollbar {

            width: 4px;

        }

        ::-webkit-scrollbar-track {

            background: #1c1f22; 

        }

        ::-webkit-scrollbar-thumb {

            background: #2C3035; 

            border-radius: 2px;

        }

        

        /* Toggle Switch Customization */

        .toggle-checkbox:checked {

            right: 0;

            border-color: #1d8ea5;

        }

        .toggle-checkbox:checked + .toggle-label {

            background-color: #1d8ea5;

        }

        

        /* Material Icon Sizing */

        .material-symbols-outlined {

            font-size: 24px;

            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;

        }

        .icon-filled {

            font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark text-[#111418] dark:text-white font-display overflow-x-hidden antialiased selection:bg-primary selection:text-white">

<div class="relative flex h-full min-h-screen w-full flex-col">

<!-- TopAppBar -->

<header class="sticky top-0 z-50 flex items-center bg-background-light dark:bg-background-dark/95 backdrop-blur-md px-4 py-3 border-b border-gray-200 dark:border-gray-800/50">

<button class="flex size-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-200 dark:text-white dark:hover:bg-white/10 transition-colors">

<span class="material-symbols-outlined">arrow_back</span>

</button>

<h2 class="text-lg font-bold leading-tight flex-1 text-center pr-10">Profile &amp; Settings</h2>

</header>

<!-- Main Content -->

<main class="flex-1 flex flex-col gap-6 p-4 pb-10 max-w-lg mx-auto w-full">

<!-- Profile Header Card -->

<section class="flex flex-col items-center gap-4 py-6">

<div class="relative">

<div class="size-28 rounded-full bg-cover bg-center border-4 border-surface-dark shadow-xl" data-alt="Portrait of the bar manager Jean-Pierre" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuCIlHhGTrMkkbZvfsCZYSOt_3G_ZLI03mGMdECZJmy_DOIrvIGArxv9GLQfzsqoYuzKd_lBICD5gl5gmw4QeT3mtYsLzNJtTPrCKrGzzWmx5sD9XKpbJ8-yF6exVSAhivFr2RF0fCJlzWO_GXhr2jEjgx8mGZ8eLlIKKLRakhgHP-fSsimQ_r9BUku6fXT4jGYZjJSxmKNp5k8bX7ZbBVfhMBC7q_Y56O_RD9pE3Px9WTRWh3MrWg1EP1zJzYWTjJ5wER6lFUJS_Fdg");'>

</div>

<!-- Status Indicator -->

<div class="absolute bottom-1 right-1 size-5 bg-green-500 border-4 border-background-dark rounded-full"></div>

</div>

<div class="flex flex-col items-center gap-1">

<h1 class="text-2xl font-bold tracking-tight text-center">Jean-Pierre N.</h1>

<div class="flex items-center gap-2 mt-1">

<span class="px-3 py-1 bg-primary/20 text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider rounded-sm">

                            Admin

                        </span>

<span class="text-gray-500 dark:text-gray-400 text-sm font-medium tracking-wide">ID: BAR-0921</span>

</div>

</div>

</section>

<!-- General Settings Section -->

<section class="flex flex-col gap-2">

<h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest px-2">General</h3>

<div class="bg-white dark:bg-surface-dark rounded-lg overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">

<!-- Language -->

<div class="group flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-highlight transition-colors border-b border-gray-100 dark:border-gray-800/50">

<div class="flex items-center justify-center size-10 rounded bg-blue-50 dark:bg-[#2C3035] text-blue-600 dark:text-primary">

<span class="material-symbols-outlined">language</span>

</div>

<div class="flex-1 flex flex-col">

<span class="text-base font-medium">Language</span>

</div>

<div class="flex items-center gap-2 text-gray-400">

<span class="text-sm text-gray-500 dark:text-gray-300">Français</span>

<span class="material-symbols-outlined text-[20px]">chevron_right</span>

</div>

</div>

<!-- Notifications -->

<div class="flex items-center gap-4 p-4 border-b border-gray-100 dark:border-gray-800/50">

<div class="flex items-center justify-center size-10 rounded bg-orange-50 dark:bg-[#2C3035] text-orange-600 dark:text-primary">

<span class="material-symbols-outlined">notifications</span>

</div>

<div class="flex-1">

<span class="text-base font-medium">Notifications</span>

</div>

<div>

<label class="flex items-center cursor-pointer relative" for="toggle-notif">

<input checked="" class="sr-only peer" id="toggle-notif" type="checkbox"/>

<div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/50 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>

</label>

</div>

</div>

<!-- Appearance (Locked) -->

<div class="flex items-center gap-4 p-4">

<div class="flex items-center justify-center size-10 rounded bg-purple-50 dark:bg-[#2C3035] text-purple-600 dark:text-primary">

<span class="material-symbols-outlined icon-filled">dark_mode</span>

</div>

<div class="flex-1">

<span class="text-base font-medium">Dark Mode</span>

</div>

<div>

<label class="flex items-center relative cursor-not-allowed opacity-80">

<input checked="" class="sr-only peer" disabled="" type="checkbox"/>

<div class="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>

</label>

</div>

</div>

</div>

</section>

<!-- Security Settings Section -->

<section class="flex flex-col gap-2">

<h3 class="text-sm font-bold text-gray-500 uppercase tracking-widest px-2">Security</h3>

<div class="bg-white dark:bg-surface-dark rounded-lg overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800">

<!-- Change Password -->

<div class="group flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-highlight transition-colors border-b border-gray-100 dark:border-gray-800/50">

<div class="flex items-center justify-center size-10 rounded bg-green-50 dark:bg-[#2C3035] text-green-600 dark:text-primary">

<span class="material-symbols-outlined">lock_reset</span>

</div>

<div class="flex-1">

<span class="text-base font-medium">Change Password</span>

</div>

<div class="text-gray-400">

<span class="material-symbols-outlined text-[20px]">chevron_right</span>

</div>

</div>

<!-- 2FA -->

<div class="group flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-highlight transition-colors">

<div class="flex items-center justify-center size-10 rounded bg-emerald-50 dark:bg-[#2C3035] text-emerald-600 dark:text-primary">

<span class="material-symbols-outlined">shield</span>

</div>

<div class="flex-1 flex flex-col">

<span class="text-base font-medium">Two-Factor Auth</span>

</div>

<div class="flex items-center gap-2">

<span class="text-sm font-medium text-green-500">Enabled</span>

<span class="material-symbols-outlined text-[20px] text-gray-400">chevron_right</span>

</div>

</div>

</div>

</section>

<!-- Logout Action -->

<div class="mt-4">

<button class="w-full group relative flex items-center justify-center gap-2 overflow-hidden rounded-lg bg-danger/10 hover:bg-danger p-4 transition-all duration-300 active:scale-[0.98]">

<span class="material-symbols-outlined text-danger group-hover:text-white transition-colors duration-300">logout</span>

<span class="text-base font-bold text-danger group-hover:text-white transition-colors duration-300">Log Out</span>

</button>

<p class="text-center text-xs text-gray-600 dark:text-gray-500 mt-4">App Version 2.4.0 (Build 9021)</p>

</div>

</main>

</div>

</body></html>

<!-- Product Catalog List -->

<!DOCTYPE html>

<html class="dark" lang="en"><head>

<meta charset="utf-8"/>

<meta content="width=device-width, initial-scale=1.0" name="viewport"/>

<title>Product Catalog List</title>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&amp;display=swap" rel="stylesheet"/>

<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>

<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>

<script id="tailwind-config">

        tailwind.config = {

            darkMode: "class",

            theme: {

                extend: {

                    colors: {

                        "primary": "#1b4498",

                        "background-light": "#fafafa",

                        "background-dark": "#18181b",

                    },

                    fontFamily: {

                        "display": ["Manrope", "sans-serif"],

                        "sans": ["Manrope", "sans-serif"]

                    },

                    borderRadius: {

                        "DEFAULT": "0.125rem", 

                        "lg": "0.25rem", 

                        "xl": "0.5rem", 

                        "full": "9999px" 

                    },

                },

            },

        }

    </script>

<style>

        /* Custom scrollbar hiding for cleaner mobile look */

        .no-scrollbar::-webkit-scrollbar {

            display: none;

        }

        .no-scrollbar {

            -ms-overflow-style: none;

            scrollbar-width: none;

        }

    </style>

<style>

    body {

      min-height: max(884px, 100dvh);

    }

  </style>

  </head>

<body class="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display antialiased text-slate-900 dark:text-white overflow-hidden selection:bg-primary selection:text-white">

<!-- Top Bar -->

<header class="shrink-0 z-20 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md sticky top-0 border-b border-zinc-200 dark:border-zinc-800">

<div class="px-4 h-16 flex items-center justify-between">

<h1 class="text-xl font-bold tracking-tight">Product Catalog</h1>

<button aria-label="Add Product" class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white transition-colors">

<span class="material-symbols-outlined">add</span>

</button>

</div>

<!-- Search Bar -->

<div class="px-4 pb-3">

<div class="relative group">

<div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500 group-focus-within:text-primary transition-colors">

<span class="material-symbols-outlined text-[20px]">search</span>

</div>

<input class="block w-full p-3 pl-10 text-sm text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800/50 border-none rounded-lg focus:ring-2 focus:ring-primary focus:bg-white dark:focus:bg-zinc-800 placeholder-zinc-500 transition-all" placeholder="Search by name or category..." type="text"/>

</div>

</div>

<!-- Filter Chips -->

<div class="px-4 pb-4">

<div class="flex gap-2 overflow-x-auto no-scrollbar pb-1">

<button class="shrink-0 h-8 px-4 rounded-full bg-primary text-white text-xs font-semibold tracking-wide border border-transparent">

                    All

                </button>

<button class="shrink-0 h-8 px-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors">

                    Beers

                </button>

<button class="shrink-0 h-8 px-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors">

                    Spirits

                </button>

<button class="shrink-0 h-8 px-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors">

                    Soft Drinks

                </button>

<button class="shrink-0 h-8 px-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs font-medium border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors">

                    Mixers

                </button>

</div>

</div>

</header>

<!-- Scrollable Content -->

<main class="flex-1 overflow-y-auto no-scrollbar pb-24">

<!-- List Item 1: Active -->

<div class="group border-b border-zinc-100 dark:border-zinc-800/60 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">

<div class="flex items-center gap-4">

<div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">

<img alt="Dark stout beer bottle with condensation" class="w-full h-full object-cover" data-alt="Dark stout beer bottle with condensation" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDoqv7nQh1kmYrGYsqe-C-J4vg2PAksqQKQR8FNyHSWN7I-MAlEvjCW2CJSPtDPLd-jlMzynYID9b3vGbu-dAN8l8VHxCk3hSDIBSzUjN8xn43ALcTenQimMx_nt3mX2TJ4WrIra1yGz25uq3d19CeQwQbHfgAqhYDo4pKmvQcMUob9XXkrvV-mimaYqqvI8HytJ8V4umyXrUfOGWZe29DfXQSkcU7X2N-wyWrapamXXsTBGkHff6wBdwRLR7bXZrOMHz6A4iw49bV8"/>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-start mb-0.5">

<h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">Guinness Smooth</h3>

<p class="text-base font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">900 FCFA</p>

</div>

<div class="flex justify-between items-end">

<div class="flex flex-col gap-0.5">

<span class="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Stout</span>

<span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded w-fit">24 in stock</span>

</div>

<!-- Custom Toggle -->

<label class="relative inline-flex items-center cursor-pointer">

<input checked="" class="sr-only peer" type="checkbox" value=""/>

<div class="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>

</label>

</div>

</div>

</div>

</div>

<!-- List Item 2: Active -->

<div class="group border-b border-zinc-100 dark:border-zinc-800/60 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">

<div class="flex items-center gap-4">

<div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">

<img alt="Light lager beer bottle golden liquid" class="w-full h-full object-cover" data-alt="Light lager beer bottle golden liquid" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAkQWLUI6S-ic9IeW8Ery6KhA9H1IH8xcE-f0F65Gg5UoQZVC2ApjIgY8AUtzcW0B5Ijh2Q-2Ma7ZmmwbOQFB5PFYmwEDDUpN_Nl39rRIYNimgoH2dkmlqTmzHiqPZvDCDeHzHe4gwY2QZ2oeKNkg0aBrU18rJJb06QLeTrIFIcbVvwosVn8XYeMkGoU6PjAzHM4C1HHgV4GZUblYYORhonvJEQMTbAR4l-eIQu6aO5-wdXYZBLQLPY62nzDOki6NdSwCcRdzc4kkRS"/>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-start mb-0.5">

<h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">Beaufort Light</h3>

<p class="text-base font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">600 FCFA</p>

</div>

<div class="flex justify-between items-end">

<div class="flex flex-col gap-0.5">

<span class="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Lager</span>

<span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded w-fit">112 in stock</span>

</div>

<!-- Custom Toggle -->

<label class="relative inline-flex items-center cursor-pointer">

<input checked="" class="sr-only peer" type="checkbox" value=""/>

<div class="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>

</label>

</div>

</div>

</div>

</div>

<!-- List Item 3: Disabled -->

<div class="group border-b border-zinc-100 dark:border-zinc-800/60 p-4 transition-colors bg-zinc-50/50 dark:bg-zinc-900/50 opacity-60">

<div class="flex items-center gap-4 grayscale-[0.5]">

<div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">

<img alt="Citrus soda bottle with orange label" class="w-full h-full object-cover opacity-70" data-alt="Citrus soda bottle with orange label" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD14lNkUbDPFwvurY_ugFnXpHj7unPDcmKY5wCtHthy0EM4ENd6T7Y98u7QLlTxa5wy5AHgxSyje_8hCPXJcVFFSf307gUPF1exlaiAUXGh4a8jrnifbYEmiR_xwVG9BlsuJ8FZGj7rr8R5qpixsabdZJg7DuamM-mSrcUZr1NHG0xAewr6QeEswsDMFZUvmcpVDGpZWgvVcBNNLAM2Yfw9G7A5nkpsEH54py-L649k9O9S2aTGbnanM9wJf7QXtg4a6R4-Wlm4wEv2"/>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-start mb-0.5">

<h3 class="text-base font-bold text-zinc-500 dark:text-zinc-400 truncate pr-2 line-through decoration-2 decoration-zinc-400 dark:decoration-zinc-600">Special Pamplemousse</h3>

<p class="text-base font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">500 FCFA</p>

</div>

<div class="flex justify-between items-end">

<div class="flex flex-col gap-0.5">

<span class="text-xs text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-wider">Soft Drink</span>

<span class="text-xs text-red-500 dark:text-red-400 font-bold bg-red-100 dark:bg-red-900/20 px-1.5 py-0.5 rounded w-fit">Out of stock</span>

</div>

<!-- Custom Toggle (Off) -->

<label class="relative inline-flex items-center cursor-pointer">

<input class="sr-only peer" type="checkbox" value=""/>

<div class="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>

</label>

</div>

</div>

</div>

</div>

<!-- List Item 4: Active -->

<div class="group border-b border-zinc-100 dark:border-zinc-800/60 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">

<div class="flex items-center gap-4">

<div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">

<img alt="Amber whiskey bottle on wooden shelf" class="w-full h-full object-cover" data-alt="Amber whiskey bottle on wooden shelf" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCZJ5Y-vcUB1yo50Y-Q-YcuWjkzmEXKMiSLnwdsA3sS4IvLKpVhhQssFYVt270UNTxqTHdbPNvZT5IcFSYV14UCgqR60hE_qd-mDs_fSYU027O8LGnJrEz92bvXa0F4AGTT5pueGYzkVweepJT-iFD_zLyJgG3wocJ0EyZLGlBQXA7PD3N9ttCzkxv4KHzfbHVFRrs0iVzY_rorWigjNulhT1OitCE3Q_HKorDHVKTyEY4lvPvslgkytKVlWFTJNP7mPKchDlaPxHSE"/>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-start mb-0.5">

<h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">Jameson Irish Whiskey</h3>

<p class="text-base font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">25,000 FCFA</p>

</div>

<div class="flex justify-between items-end">

<div class="flex flex-col gap-0.5">

<span class="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Whiskey</span>

<span class="text-xs text-orange-600 dark:text-orange-400 font-bold bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded w-fit">4 in stock</span>

</div>

<!-- Custom Toggle -->

<label class="relative inline-flex items-center cursor-pointer">

<input checked="" class="sr-only peer" type="checkbox" value=""/>

<div class="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>

</label>

</div>

</div>

</div>

</div>

<!-- List Item 5: Active -->

<div class="group border-b border-zinc-100 dark:border-zinc-800/60 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">

<div class="flex items-center gap-4">

<div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">

<img alt="Red cola can with condensation droplets" class="w-full h-full object-cover" data-alt="Red cola can with condensation droplets" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCm3ElAcf5N8lQUfc1a90_Ec0Hk2CywVO4yB62a9d8rvaefHW_-ylKvqEtPkvAB1ePYPz9oGc6Rn8bXqeW6ketLAbxH9C5QZe83OhHV4UFOi7YlUwEC_spgWnXjjKLrTmw_ueX8S7iMwiqSQXao5Hd7UdKDD4neMjx3Oi3uvw9nslrN7N6-6ukiX9DX6ABKdPWl3_GpqbZJAfazskIcVTouXGpxAHGuotqVQcTFJK2_WVfK2UgrCglvsXc0Ga0-BhWHqAfPdIT_hy59"/>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-start mb-0.5">

<h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">Coca-Cola 33cl</h3>

<p class="text-base font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">500 FCFA</p>

</div>

<div class="flex justify-between items-end">

<div class="flex flex-col gap-0.5">

<span class="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Soft Drink</span>

<span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded w-fit">86 in stock</span>

</div>

<!-- Custom Toggle -->

<label class="relative inline-flex items-center cursor-pointer">

<input checked="" class="sr-only peer" type="checkbox" value=""/>

<div class="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>

</label>

</div>

</div>

</div>

</div>

<!-- List Item 6: Active -->

<div class="group border-b border-zinc-100 dark:border-zinc-800/60 p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/30">

<div class="flex items-center gap-4">

<div class="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-zinc-800 shadow-sm border border-zinc-200 dark:border-zinc-700">

<img alt="Clear bottle of water on dark background" class="w-full h-full object-cover" data-alt="Clear bottle of water on dark background" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTDoHxdIHwaKdeIpPdP1KpAiPTIwncKrOkaZGNCWDjK8v1uj0oYDshpYenwy3gLNrF0ucTayEBkbrwRHGv6j4U3cjgeL-nAGMzPxPFoAL317zRRtRpZPFzvEuvOOrM0fz0V-QF8G0pBdTUFlUYBKjkg57zkMtTeTff6uRifsafbUAp-EYZptpXvWKC8NwUD0Q8Nq7LxaTDYkWJ7YTmfK8vLWMp1lLztZfHNgfOgXEM-YC4BKjOeJzyCtL76EhqeDi_nH0fJbl3yFMP"/>

</div>

<div class="flex-1 min-w-0">

<div class="flex justify-between items-start mb-0.5">

<h3 class="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate pr-2">Supermont 1.5L</h3>

<p class="text-base font-bold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">400 FCFA</p>

</div>

<div class="flex justify-between items-end">

<div class="flex flex-col gap-0.5">

<span class="text-xs text-zinc-500 dark:text-zinc-400 font-medium uppercase tracking-wider">Water</span>

<span class="text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded w-fit">200 in stock</span>

</div>

<!-- Custom Toggle -->

<label class="relative inline-flex items-center cursor-pointer">

<input checked="" class="sr-only peer" type="checkbox" value=""/>

<div class="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>

</label>

</div>

</div>

</div>

</div>

</main>

<!-- Bottom Navigation -->

<nav class="shrink-0 bg-white dark:bg-[#121215] border-t border-zinc-200 dark:border-zinc-800 px-6 pb-6 pt-3 z-30">

<ul class="flex justify-between items-end">

<li class="flex flex-col items-center gap-1 w-16 group cursor-pointer">

<span class="material-symbols-outlined text-primary text-[28px] group-hover:scale-110 transition-transform">inventory_2</span>

<span class="text-[10px] font-bold text-primary">Catalog</span>

</li>

<li class="flex flex-col items-center gap-1 w-16 group cursor-pointer">

<span class="material-symbols-outlined text-zinc-400 dark:text-zinc-500 text-[26px] group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">point_of_sale</span>

<span class="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Sales</span>

</li>

<li class="flex flex-col items-center gap-1 w-16 group cursor-pointer">

<span class="material-symbols-outlined text-zinc-400 dark:text-zinc-500 text-[26px] group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">monitoring</span>

<span class="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Reports</span>

</li>

<li class="flex flex-col items-center gap-1 w-16 group cursor-pointer">

<span class="material-symbols-outlined text-zinc-400 dark:text-zinc-500 text-[26px] group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">settings</span>

<span class="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">Settings</span>

</li>

</ul>

</nav>

</body></html>