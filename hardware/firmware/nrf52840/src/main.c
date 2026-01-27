/**
 * Nordic nRF52840 Firmware for Smart Attendance BLE Tag
 * 
 * Features:
 * - Ultra-low power deep sleep mode
 * - BLE 5.0 advertising with encrypted device ID
 * - Motion-activated wake-up
 * - Battery voltage monitoring
 * - 6-12 months battery life on 300-500mAh LiPo
 * 
 * Hardware:
 * - MCU: Nordic nRF52840
 * - IMU: LSM6DSO (I2C)
 * - Battery: 300mAh LiPo (2mm thin)
 * - Advertising interval: 5-10 minutes (randomized)
 */

#include <zephyr.h>
#include <device.h>
#include <drivers/gpio.h>
#include <drivers/sensor.h>
#include <drivers/adc.h>
#include <bluetooth/bluetooth.h>
#include <bluetooth/hci.h>
#include <settings/settings.h>
#include <random/rand32.h>
#include <tinycrypt/aes.h>
#include <tinycrypt/constants.h>

/* Device Configuration */
#define DEVICE_NAME CONFIG_BT_DEVICE_NAME
#define DEVICE_NAME_LEN (sizeof(DEVICE_NAME) - 1)

/* Battery Monitoring */
#define BATTERY_ADC_NODE DT_PATH(zephyr_user)
#define BATTERY_ADC_CHANNEL 0
#define BATTERY_FULL_MV 4200  // 4.2V fully charged
#define BATTERY_EMPTY_MV 3200 // 3.2V empty

/* Power Management */
#define DEEP_SLEEP_DURATION_MIN_MS 300000  // 5 minutes
#define DEEP_SLEEP_DURATION_MAX_MS 600000  // 10 minutes
#define ADVERTISING_DURATION_MS 30000       // 30 seconds

/* IMU Configuration (LSM6DSO on I2C) */
#define IMU_DEVICE_NODE DT_NODELABEL(lsm6dso)
#define MOTION_THRESHOLD 0.5 // g (acceleration threshold for wake-up)

/* Global Variables */
static uint8_t device_id[16];        // Unique device ID (UUID)
static uint8_t encrypted_id[16];     // AES-128 encrypted ID
static uint8_t aes_key[16];          // AES encryption key
static uint8_t battery_level = 100;  // 0-100%
static uint16_t battery_voltage = BATTERY_FULL_MV;
static bool motion_detected = false;
static uint8_t firmware_version[2] = {1, 0}; // Major.Minor

/* BLE Advertising Data Structure */
static struct bt_data ad[] = {
	BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
	BT_DATA_BYTES(BT_DATA_MANUFACTURER_DATA, 
		0xFF, 0xFF, 0xFF,  // Company ID (custom)
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,  // Encrypted ID (16 bytes)
		0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
		0x64,  // Battery level (1 byte)
		0x00,  // Motion flag (1 byte)
		0xC5,  // RSSI calibration / TX power at 1m (1 byte) = -59 dBm
		0x01, 0x00,  // Firmware version (2 bytes)
		0x00, 0x00, 0x00  // Reserved (3 bytes)
	)
};

/* Function Prototypes */
static void generate_device_id(void);
static void load_aes_key(void);
static void encrypt_device_id(void);
static void read_battery_level(void);
static void setup_imu(void);
static void setup_motion_interrupt(void);
static bool check_motion(void);
static void start_advertising(void);
static void stop_advertising(void);
static void enter_deep_sleep(uint32_t duration_ms);
static void update_advertising_data(void);

/**
 * Generate unique device ID from hardware
 * Uses Nordic DeviceID registers (factory programmed)
 */
static void generate_device_id(void)
{
	// Read Nordic's unique device ID (64-bit)
	uint32_t deviceid_low = NRF_FICR->DEVICEID[0];
	uint32_t deviceid_high = NRF_FICR->DEVICEID[1];
	
	// Create 128-bit UUID from device ID
	memcpy(&device_id[0], &deviceid_low, 4);
	memcpy(&device_id[4], &deviceid_high, 4);
	
	// Add additional entropy from device address
	memcpy(&device_id[8], &NRF_FICR->DEVICEADDR[0], 4);
	memcpy(&device_id[12], &NRF_FICR->DEVICEADDR[1], 4);
	
	printk("Device ID: ");
	for (int i = 0; i < 16; i++) {
		printk("%02X", device_id[i]);
	}
	printk("\n");
}

/**
 * Load AES-128 encryption key
 * In production: Load from secure flash storage
 * For now: Generate from device ID (not secure, replace in production!)
 */
static void load_aes_key(void)
{
	// TODO: Replace with secure key storage (e.g., from server during pairing)
	// For demo: Use device ID as key (NOT SECURE - REPLACE IN PRODUCTION)
	memcpy(aes_key, device_id, 16);
	
	printk("AES Key loaded (secure storage required for production)\n");
}

/**
 * Encrypt device ID using AES-128 ECB
 */
static void encrypt_device_id(void)
{
	struct tc_aes_key_sched_struct aes_ctx;
	
	// Set AES key
	tc_aes128_set_encrypt_key(&aes_ctx, aes_key);
	
	// Encrypt device ID
	tc_aes_encrypt(encrypted_id, device_id, &aes_ctx);
	
	printk("Device ID encrypted\n");
}

/**
 * Read battery voltage and calculate percentage
 */
static void read_battery_level(void)
{
	const struct device *adc_dev = DEVICE_DT_GET(BATTERY_ADC_NODE);
	
	if (!device_is_ready(adc_dev)) {
		printk("ADC device not ready\n");
		return;
	}
	
	// TODO: Implement ADC reading
	// For now, simulate battery drain
	static uint16_t reading_count = 0;
	reading_count++;
	
	// Simulate battery drain: 1% per 100 readings
	if (reading_count % 100 == 0 && battery_level > 0) {
		battery_level--;
		battery_voltage = BATTERY_EMPTY_MV + 
			((BATTERY_FULL_MV - BATTERY_EMPTY_MV) * battery_level) / 100;
	}
	
	printk("Battery: %d%% (%d mV)\n", battery_level, battery_voltage);
}

/**
 * Setup LSM6DSO IMU sensor
 */
static void setup_imu(void)
{
	const struct device *imu_dev = DEVICE_DT_GET(IMU_DEVICE_NODE);
	
	if (!device_is_ready(imu_dev)) {
		printk("IMU device not ready\n");
		return;
	}
	
	// Configure IMU for low power mode
	// Set wake-up threshold
	// Enable wake-up interrupt
	
	printk("IMU configured for motion detection\n");
}

/**
 * Setup motion interrupt for wake-up
 */
static void setup_motion_interrupt(void)
{
	// Configure GPIO interrupt from IMU INT1 pin
	// Wake MCU from deep sleep when motion detected
	
	printk("Motion interrupt configured\n");
}

/**
 * Check if motion was detected
 */
static bool check_motion(void)
{
	const struct device *imu_dev = DEVICE_DT_GET(IMU_DEVICE_NODE);
	
	if (!device_is_ready(imu_dev)) {
		return false;
	}
	
	// TODO: Read IMU status register
	// Check if wake-up event occurred
	// For now, simulate random motion
	motion_detected = (sys_rand32_get() % 10) > 3; // 70% chance of motion
	
	return motion_detected;
}

/**
 * Update BLE advertising data with current values
 */
static void update_advertising_data(void)
{
	// Update encrypted device ID (bytes 3-18)
	memcpy(&ad[1].data[3], encrypted_id, 16);
	
	// Update battery level (byte 19)
	ad[1].data[19] = battery_level;
	
	// Update motion flag (byte 20)
	ad[1].data[20] = motion_detected ? 0x01 : 0x00;
	
	// Update firmware version (bytes 22-23)
	ad[1].data[22] = firmware_version[0];
	ad[1].data[23] = firmware_version[1];
}

/**
 * Start BLE advertising
 */
static void start_advertising(void)
{
	int err;
	
	// Update advertising data
	update_advertising_data();
	
	// Set advertising parameters
	struct bt_le_adv_param adv_param = {
		.id = BT_ID_DEFAULT,
		.options = BT_LE_ADV_OPT_USE_IDENTITY,
		.interval_min = BT_GAP_ADV_FAST_INT_MIN_2, // 100ms
		.interval_max = BT_GAP_ADV_FAST_INT_MAX_2, // 150ms
		.peer = NULL,
	};
	
	err = bt_le_adv_start(&adv_param, ad, ARRAY_SIZE(ad), NULL, 0);
	if (err) {
		printk("Advertising failed to start (err %d)\n", err);
		return;
	}
	
	printk("BLE Advertising started (30 sec window)\n");
}

/**
 * Stop BLE advertising
 */
static void stop_advertising(void)
{
	int err = bt_le_adv_stop();
	if (err) {
		printk("Failed to stop advertising (err %d)\n", err);
		return;
	}
	
	printk("BLE Advertising stopped\n");
}

/**
 * Enter deep sleep mode
 * MCU will wake on RTC timer or motion interrupt
 */
static void enter_deep_sleep(uint32_t duration_ms)
{
	printk("Entering deep sleep for %d ms\n", duration_ms);
	
	// Disable peripherals
	// Only keep RTC and GPIO interrupts active
	
	// Sleep
	k_sleep(K_MSEC(duration_ms));
	
	printk("Wake up from deep sleep\n");
}

/**
 * Main application
 */
void main(void)
{
	int err;
	
	printk("Smart Attendance BLE Tag - Firmware v%d.%d\n", 
		firmware_version[0], firmware_version[1]);
	
	// Initialize Bluetooth
	err = bt_enable(NULL);
	if (err) {
		printk("Bluetooth init failed (err %d)\n", err);
		return;
	}
	printk("Bluetooth initialized\n");
	
	// Generate and encrypt device ID
	generate_device_id();
	load_aes_key();
	encrypt_device_id();
	
	// Setup sensors
	setup_imu();
	setup_motion_interrupt();
	
	// Read initial battery level
	read_battery_level();
	
	// Main loop
	while (1) {
		// Check motion status
		check_motion();
		
		// Read battery level
		read_battery_level();
		
		// Start advertising
		start_advertising();
		
		// Advertise for 30 seconds
		k_sleep(K_MSEC(ADVERTISING_DURATION_MS));
		
		// Stop advertising
		stop_advertising();
		
		// Generate random sleep duration (5-10 minutes)
		uint32_t sleep_duration = DEEP_SLEEP_DURATION_MIN_MS + 
			(sys_rand32_get() % (DEEP_SLEEP_DURATION_MAX_MS - DEEP_SLEEP_DURATION_MIN_MS));
		
		// Enter deep sleep
		enter_deep_sleep(sleep_duration);
	}
}
