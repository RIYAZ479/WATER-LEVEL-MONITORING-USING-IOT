#define TRIG_PIN 9
#define ECHO_PIN 10
#define BUZZER_PIN 8

const int TANK_HEIGHT = 30;
const int ALERT_LEVEL = 25;

void setup() {
  Serial.begin(9600);

  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  noTone(BUZZER_PIN); // ensure buzzer starts OFF
}

void loop() {

  // Trigger ultrasonic sensor
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH);

  float distance = duration * 0.034 / 2;

  float waterLevel = TANK_HEIGHT - distance;

  if (waterLevel < 0) waterLevel = 0;
  if (waterLevel > TANK_HEIGHT) waterLevel = TANK_HEIGHT;

  // Send to web dashboard
  Serial.print(distance);
  Serial.print(",");
  Serial.println(waterLevel);

  // 🔔 SMART BUZZER CONTROL (MH-FMD)
  if (waterLevel >= ALERT_LEVEL) {

    // Beeping effect (better than constant tone)
    tone(BUZZER_PIN, 1000);
    delay(200);
    noTone(BUZZER_PIN);
    delay(200);

  } else {
    noTone(BUZZER_PIN);
  }

  delay(800);
}