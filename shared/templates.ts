export type TemplateId = 'arduino-blink' | 'python-hello' | 'cpp-module';

export interface ProjectTemplateFile {
  path: string;
  content: string;
}

export interface ProjectTemplate {
  id: TemplateId;
  label: string;
  description: string;
  files: ProjectTemplateFile[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'arduino-blink',
    label: 'Arduino blink',
    description: 'Minimal Arduino-style sketch for MeowKit S3.',
    files: [
      {
        path: 'src/main.ino',
        content: `#include <Arduino.h>

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("meow");
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`,
      },
      {
        path: 'config.json',
        content: `{
  "board": "meowkit-s3",
  "baud": 115200,
  "template": "arduino-blink"
}
`,
      },
      {
        path: 'README.md',
        content: `# Arduino blink

Open Serial at 115200 after flashing to see \`meow\` logs.
`,
      },
    ],
  },
  {
    id: 'python-hello',
    label: 'Python hello',
    description: 'MicroPython-style starter for scripting on MeowKit.',
    files: [
      {
        path: 'src/main.py',
        content: `print("hello from MeowKit")

def blink(times=3):
    for i in range(times):
        print(f"blink {i + 1}")
`,
      },
      {
        path: 'apps/manifest.json',
        content: `{
  "apps": []
}
`,
      },
      {
        path: 'config.json',
        content: `{
  "board": "meowkit-s3",
  "baud": 115200,
  "template": "python-hello"
}
`,
      },
      {
        path: 'README.md',
        content: `# Python hello

Use Build once a Python toolchain path is set in Settings.
`,
      },
    ],
  },
  {
    id: 'cpp-module',
    label: 'C++ firmware module',
    description: 'ESP-IDF style main.cpp scaffold.',
    files: [
      {
        path: 'src/main.cpp',
        content: `#include <cstdio>

extern "C" void app_main(void) {
  std::printf("MeowKit module ready\\n");
}
`,
      },
      {
        path: 'firmware/partitions.csv',
        content: `# Name, Type, SubType, Offset, Size
nvs, data, nvs, 0x9000, 0x5000
app0, app, ota_0, 0x10000, 0xC80000
`,
      },
      {
        path: 'config.json',
        content: `{
  "board": "meowkit-s3",
  "baud": 115200,
  "template": "cpp-module"
}
`,
      },
      {
        path: 'README.md',
        content: `# C++ module

Point Settings → Toolchain to ESP-IDF, then Build.
`,
      },
    ],
  },
];

export function getTemplate(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find((template) => template.id === id);
}
