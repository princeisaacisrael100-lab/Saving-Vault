;; Test file for Savings Vault Contract
;; Run with: clarinet test

(define-constant deployer 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM)
(define-constant user1 'ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5)
(define-constant user2 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG)

;; Test 1: Deployment and initial configuration
(define-public (test-initial-config)
  (let
    (
      (config (unwrap-panic (contract-call? .savings-vault get-contract-config)))
    )
    (asserts! (is-eq (get annual-interest-rate config) u500) (err u1))
    (asserts! (is-eq (get minimum-deposit config) u1000000) (err u2))
    (asserts! (is-eq (get total-deposits config) u0) (err u3))
    (asserts! (is-eq (get contract-paused config) false) (err u4))
    (ok true)
  )
)

;; Test 2: Successful deposit
(define-public (test-deposit-success)
  (begin
    ;; User1 deposits 10 STX with 1440 block lock period (10 days)
    (try! (as-contract (contract-call? .savings-vault deposit u10000000 u1440)))
    
    ;; Verify savings created
    (match (contract-call? .savings-vault get-user-savings tx-sender)
      savings-opt
      (match savings-opt
        savings
        (begin
          (asserts! (is-eq (get balance savings) u10000000) (err u5))
          (asserts! (is-eq (get lock-period savings) u1440) (err u6))
          (ok true)
        )
        (err u7)
      )
      error (err error)
    )
  )
)

;; Test 3: Deposit with insufficient amount
(define-public (test-deposit-insufficient)
  (match (contract-call? .savings-vault deposit u500000 u1440)
    success (err u8)
    error
    (if (is-eq error (err u108))
      (ok true)
      (err u9)
    )
  )
)

;; Test 4: Deposit with invalid lock period (too short)
(define-public (test-deposit-invalid-lock-short)
  (match (contract-call? .savings-vault deposit u1000000 u100)
    success (err u10)
    error
    (if (is-eq error (err u105))
      (ok true)
      (err u11)
    )
  )
)

;; Test 5: Deposit with invalid lock period (too long)
(define-public (test-deposit-invalid-lock-long)
  (match (contract-call? .savings-vault deposit u1000000 u60000)
    success (err u12)
    error
    (if (is-eq error (err u105))
      (ok true)
      (err u13)
    )
  )
)

;; Test 6: Cannot withdraw before lock period
(define-public (test-withdraw-before-lock)
  (begin
    ;; Deposit first
    (try! (contract-call? .savings-vault deposit u5000000 u1440))
    
    ;; Try to withdraw immediately
    (match (contract-call? .savings-vault withdraw)
      success (err u14)
      error
      (if (is-eq error (err u103))
        (ok true)
        (err u15)
      )
    )
  )
)

;; Test 7: Interest calculation
(define-public (test-interest-calculation)
  (begin
    ;; Deposit 10 STX
    (try! (contract-call? .savings-vault deposit u10000000 u1440))
    
    ;; Mine some blocks (simulate time passing)
    ;; In actual test, use clarinet's advance-chain-tip
    
    ;; Calculate interest
    (match (contract-call? .savings-vault calculate-interest tx-sender)
      interest
      (begin
        ;; Interest should be > 0 after some blocks
        ;; Exact calculation: (10000000 * 500 * blocks) / (10000 * 52560)
        (ok true)
      )
      error (err error)
    )
  )
)

;; Test 8: Emergency withdrawal with penalty
(define-public (test-emergency-withdraw)
  (begin
    ;; Deposit 10 STX
    (try! (contract-call? .savings-vault deposit u10000000 u1440))
    
    ;; Emergency withdraw immediately
    (match (contract-call? .savings-vault emergency-withdraw)
      result
      (let
        (
          (withdrawn (get withdrawn result))
          (penalty (get penalty result))
          ;; Penalty should be 10% = 1 STX
          (expected-penalty u1000000)
          (expected-withdrawn u9000000)
        )
        (asserts! (is-eq penalty expected-penalty) (err u16))
        (asserts! (is-eq withdrawn expected-withdrawn) (err u17))
        (ok true)
      )
      error (err error)
    )
  )
)

;; Test 9: Owner can set interest rate
(define-public (test-set-interest-rate)
  (begin
    ;; As owner, set new rate
    (try! (as-contract (contract-call? .savings-vault set-interest-rate u1000)))
    
    ;; Verify it was set
    (match (contract-call? .savings-vault get-contract-config)
      config
      (begin
        (asserts! (is-eq (get annual-interest-rate config) u1000) (err u18))
        (ok true)
      )
      error (err error)
    )
  )
)

;; Test 10: Non-owner cannot set interest rate
(define-public (test-set-interest-rate-unauthorized)
  (match (contract-call? .savings-vault set-interest-rate u1000)
    success (err u19)
    error
    (if (is-eq error (err u100))
      (ok true)
      (err u20)
    )
  )
)

;; Test 11: Owner can pause contract
(define-public (test-pause-contract)
  (begin
    (try! (as-contract (contract-call? .savings-vault pause-contract)))
    
    (match (contract-call? .savings-vault is-paused)
      is-paused
      (begin
        (asserts! is-paused (err u21))
        (ok true)
      )
      error (err error)
    )
  )
)

;; Test 12: Cannot deposit when paused
(define-public (test-deposit-when-paused)
  (begin
    ;; Pause contract
    (try! (as-contract (contract-call? .savings-vault pause-contract)))
    
    ;; Try to deposit
    (match (contract-call? .savings-vault deposit u1000000 u1440)
      success (err u22)
      error
      (if (is-eq error (err u107))
        (ok true)
        (err u23)
      )
    )
  )
)

;; Test 13: Multiple deposits increase balance
(define-public (test-multiple-deposits)
  (begin
    ;; First deposit
    (try! (contract-call? .savings-vault deposit u5000000 u1440))
    
    ;; Second deposit
    (try! (contract-call? .savings-vault deposit u5000000 u1440))
    
    ;; Check total balance
    (match (contract-call? .savings-vault get-user-savings tx-sender)
      savings-opt
      (match savings-opt
        savings
        (begin
          (asserts! (is-eq (get balance savings) u10000000) (err u24))
          (ok true)
        )
        (err u25)
      )
      error (err error)
    )
  )
)

;; Test 14: TVL increases with deposits
(define-public (test-tvl-tracking)
  (begin
    ;; Get initial TVL
    (let
      (
        (initial-tvl (unwrap-panic (contract-call? .savings-vault get-tvl)))
      )
      ;; Make deposit
      (try! (contract-call? .savings-vault deposit u10000000 u1440))
      
      ;; Check TVL increased
      (match (contract-call? .savings-vault get-tvl)
        new-tvl
        (begin
          (asserts! (is-eq new-tvl (+ initial-tvl u10000000)) (err u26))
          (ok true)
        )
        error (err error)
      )
    )
  )
)

;; Test 15: User stats tracking
(define-public (test-user-stats)
  (begin
    ;; Make deposit
    (try! (contract-call? .savings-vault deposit u10000000 u1440))
    
    ;; Check stats
    (match (contract-call? .savings-vault get-user-stats tx-sender)
      stats-opt
      (match stats-opt
        stats
        (begin
          (asserts! (is-eq (get total-deposited stats) u10000000) (err u27))
          (asserts! (is-eq (get total-withdrawn stats) u0) (err u28))
          (ok true)
        )
        (err u29)
      )
      error (err error)
    )
  )
)
